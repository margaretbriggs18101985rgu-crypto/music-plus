import { DeviceEventEmitter, NativeModules } from 'react-native'
import BackgroundTimer from 'react-native-background-timer'
import { getAllKeys, getData, removeDataMultiple, saveData } from '@/plugins/storage'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { addListMusics, getListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import { LIST_IDS } from '@/config/constant'
import { getTrackLanguage, getTrackStyles } from './recommendation'

export const LIBRARY_EVENT = 'lx_musicLibraryUpdated'
export const OPEN_LIBRARY = 'lx_openLibraryPlaylist'
export interface RecentTrack {
  music: LX.Music.MusicInfo
  playedAt: number
  firstPlayedAt?: number
  playCount?: number
  listenedSeconds?: number
  completedCount?: number
  measuredSessions?: number
  measuredListenedSeconds?: number
  listenedRatioTotal?: number
}
export interface DownloadStatus { status: number, reason: number, bytes: number, total: number, uri?: string }
export interface Folder { uri: string, name: string }
export interface DownloadJob { id: number, musicId: string, filename: string, title: string, folderName: string, music?: LX.Music.MusicInfo }
export interface DownloadBridge {
  chooseFolder: () => Promise<Folder | null>
  chooseCover: () => Promise<string | null>
  start: (url: string, filename: string, title: string, tree: string) => Promise<number>
  query: (id: number) => Promise<DownloadStatus>
  cancel: (id: number) => Promise<void>
  open: (id: number) => Promise<void>
}
export const downloader = NativeModules.LXMusicDownload as DownloadBridge
const RECENT = 'musicplus_recent_tracks'
const DOWNLOADS = 'musicplus_download_jobs'
const COVERS = 'musicplus_playlist_covers'
const LISTENING_DAY_PREFIX = '@musicplus_listening_day__'
const LISTEN_TICK_MS = 15_000
const MAX_LISTEN_TICK_SECONDS = 30
const EVENT_FLUSH_MS = 60_000

export type ListeningReportPeriod = 'day' | 'week' | 'month' | 'year'

export interface ListeningTrack {
  id: string
  name: string
  singer: string
  source: string
  interval: string | null
  albumName: string
  picUrl?: string | null
}

export interface ListeningEventSegment {
  id: string
  startedAt: number
  track: ListeningTrack
  listenedSeconds: number
  completed: boolean
  startedHere: boolean
}

export interface ListeningDay {
  version: 1
  date: string
  events: ListeningEventSegment[]
}

export interface ListeningReportTrack {
  track: ListeningTrack
  playCount: number
  listenedSeconds: number
  completedCount: number
}

export interface ListeningReportTrend {
  date: string
  playCount: number
  listenedSeconds: number
  favoriteSong: string
}

export interface ListeningReport {
  period: ListeningReportPeriod
  startAt: number
  endAt: number
  playCount: number
  uniqueSongCount: number
  listenedSeconds: number
  topSong: ListeningReportTrack | null
  topArtist: { name: string, playCount: number } | null
  topLanguage: { id: string, playCount: number } | null
  topStyle: { id: string, playCount: number } | null
  hourDistribution: number[]
  trend: ListeningReportTrend[]
  hasEvents: boolean
}

const pad = (value: number) => String(value).padStart(2, '0')
export const getListeningDayKey = (timestamp: number) => {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const localDayStart = (timestamp: number) => {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}
const moveLocalDays = (timestamp: number, days: number) => {
  const date = new Date(timestamp)
  date.setDate(date.getDate() + days)
  return date.getTime()
}
const periodRange = (period: ListeningReportPeriod, timestamp: number) => {
  const current = new Date(timestamp)
  if (period == 'day') {
    const start = localDayStart(timestamp)
    return { startAt: start, endAt: moveLocalDays(start, 1) }
  }
  if (period == 'week') {
    const start = localDayStart(timestamp)
    const mondayOffset = (new Date(start).getDay() + 6) % 7
    const monday = moveLocalDays(start, -mondayOffset)
    return { startAt: monday, endAt: moveLocalDays(monday, 7) }
  }
  if (period == 'month') {
    const start = new Date(current.getFullYear(), current.getMonth(), 1).getTime()
    return { startAt: start, endAt: new Date(current.getFullYear(), current.getMonth() + 1, 1).getTime() }
  }
  const start = new Date(current.getFullYear(), 0, 1).getTime()
  return { startAt: start, endAt: new Date(current.getFullYear() + 1, 0, 1).getTime() }
}

export const getListeningPeriodRange = periodRange
const getListeningDay = async(date: string): Promise<ListeningDay> => {
  const value = await getData<ListeningDay>(LISTENING_DAY_PREFIX + date)
  return value && Array.isArray(value.events) ? value : { version: 1, date, events: [] }
}
const getListeningDays = async(startAt: number, endAt: number) => {
  const dates: string[] = []
  for (let day = localDayStart(startAt); day < endAt; day = moveLocalDays(day, 1)) dates.push(getListeningDayKey(day))
  return Promise.all(dates.map(getListeningDay))
}
const trackSnapshot = (music: LX.Music.MusicInfo): ListeningTrack => ({
  id: music.id,
  name: music.name,
  singer: music.singer,
  source: music.source,
  interval: music.interval,
  albumName: music.meta?.albumName ?? '',
  picUrl: music.meta?.picUrl ?? null,
})
const trackSignals = (track: ListeningTrack) => ({ name: track.name, singer: track.singer, interval: track.interval, meta: { albumName: track.albumName } })
const artistSeparators = /、|&|;|；|\/|,|，|\|/g
const reportArtistNames = (singer: string) => singer.split(artistSeparators).map(value => value.trim()).filter(Boolean)
const reportTrackKey = (track: ListeningTrack) => track.id || `${track.name}\u0000${track.singer}`

export const getListeningReport = async(period: ListeningReportPeriod, timestamp = Date.now()): Promise<ListeningReport> => {
  const { startAt, endAt } = periodRange(period, timestamp)
  const days = await getListeningDays(startAt, endAt)
  const inRange = days.flatMap(day => day.events)
  const starts = inRange.filter(event => event.startedHere && event.startedAt >= startAt && event.startedAt < endAt)
  const tracks = new Map<string, ListeningReportTrack>()
  const artists = new Map<string, number>()
  const languages = new Map<string, number>()
  const styles = new Map<string, number>()
  const hours = Array.from({ length: 24 }, () => 0)
  const trend = days.map(day => {
    const dayStarts = day.events.filter(event => event.startedHere)
    const dayTracks = new Map<string, number>()
    for (const event of dayStarts) dayTracks.set(reportTrackKey(event.track), (dayTracks.get(reportTrackKey(event.track)) ?? 0) + 1)
    const favorite = [...dayTracks.entries()].sort((a, b) => b[1] - a[1])[0]
    return {
      date: day.date,
      playCount: dayStarts.length,
      listenedSeconds: day.events.reduce((total, event) => total + Math.max(0, event.listenedSeconds), 0),
      favoriteSong: favorite ? day.events.find(event => reportTrackKey(event.track) == favorite[0])?.track.name ?? '' : '',
    }
  })
  let listenedSeconds = 0
  for (const event of inRange) {
    listenedSeconds += Math.max(0, event.listenedSeconds)
    const key = reportTrackKey(event.track)
    const current = tracks.get(key) ?? { track: event.track, playCount: 0, listenedSeconds: 0, completedCount: 0 }
    current.listenedSeconds += Math.max(0, event.listenedSeconds)
    if (event.startedHere) {
      current.playCount += 1
      const hour = new Date(event.startedAt).getHours()
      hours[hour] += 1
      for (const artist of reportArtistNames(event.track.singer)) artists.set(artist, (artists.get(artist) ?? 0) + 1)
      const language = getTrackLanguage(trackSignals(event.track))
      if (language) languages.set(language, (languages.get(language) ?? 0) + 1)
      for (const style of getTrackStyles(trackSignals(event.track))) styles.set(style, (styles.get(style) ?? 0) + 1)
    }
    if (event.completed) current.completedCount += 1
    tracks.set(key, current)
  }
  const topByCount = (map: Map<string, number>) => {
    const item = [...map.entries()].sort((a, b) => b[1] - a[1])[0]
    return item ? { id: item[0], playCount: item[1] } : null
  }
  const topSong = [...tracks.values()].sort((a, b) => b.playCount - a.playCount || b.listenedSeconds - a.listenedSeconds)[0] ?? null
  return {
    period,
    startAt,
    endAt,
    playCount: starts.length,
    uniqueSongCount: new Set(starts.map(event => reportTrackKey(event.track))).size,
    listenedSeconds,
    topSong,
    topArtist: (() => { const item = topByCount(artists); return item ? { name: item.id, playCount: item.playCount } : null })(),
    topLanguage: topByCount(languages),
    topStyle: topByCount(styles),
    hourDistribution: hours,
    trend,
    hasEvents: inRange.length > 0,
  }
}
// Serialize read-modify-write operations, including rapid track changes and cover selection.
let writes: Promise<unknown> = Promise.resolve()
const write = async <T>(action: () => Promise<T>): Promise<T> => {
  const result = writes.then(action)
  writes = result.catch(() => {})
  return result
}
export const getRecentTracks = async() => await getData<RecentTrack[]>(RECENT) ?? []
export interface ListeningTrackSummary {
  firstPlayedAt: number | null
  playCount: number
  listenedSeconds: number
}
export const getTrackListeningSummary = async(musicId: string): Promise<ListeningTrackSummary> => {
  const recent = (await getRecentTracks()).find(item => item.music.id == musicId)
  const keys = (await getAllKeys()).filter(key => key.startsWith(LISTENING_DAY_PREFIX))
  let firstPlayedAt: number | null = null
  let playCount = 0
  let listenedSeconds = 0
  const days = await Promise.all(keys.map(async key => getData<ListeningDay>(key)))
  for (const day of days) {
    if (!day?.events) continue
    for (const event of day.events) {
      if (event.track.id != musicId) continue
      listenedSeconds += Math.max(0, event.listenedSeconds)
      if (!event.startedHere) continue
      playCount += 1
      if (firstPlayedAt == null || event.startedAt < firstPlayedAt) firstPlayedAt = event.startedAt
    }
  }
  return {
    firstPlayedAt: firstPlayedAt ?? recent?.firstPlayedAt ?? null,
    playCount: Math.max(playCount, recent?.playCount ?? 0),
    listenedSeconds: Math.max(listenedSeconds, recent?.listenedSeconds ?? 0),
  }
}
export const getPlaylistCovers = async() => await getData<Record<string, string>>(COVERS) ?? {}
export const setPlaylistCover = async(id: string, uri?: string) => write(async() => {
  const covers = await getPlaylistCovers()
  if (uri) covers[id] = uri
  else delete covers[id]
  await saveData(COVERS, covers)
  DeviceEventEmitter.emit(LIBRARY_EVENT)
})
export const getDownloadJobs = async(): Promise<DownloadJob[]> => {
  const jobs = await getData<DownloadJob[]>(DOWNLOADS) ?? []
  const previous = await getData<DownloadJob>('musicplus_latest_download')
  return previous && !jobs.some(job => job.id == previous.id) ? [previous, ...jobs] : jobs
}
export const saveDownloadJob = async(job: DownloadJob) => write(async() => {
  const jobs = await getDownloadJobs()
  await saveData(DOWNLOADS, [job, ...jobs.filter(item => item.id != job.id)])
  await saveData('musicplus_latest_download', job)
  DeviceEventEmitter.emit(LIBRARY_EVENT)
})
export const forgetDownloadJob = async(id: number) => write(async() => {
  await saveData(DOWNLOADS, (await getDownloadJobs()).filter(job => job.id != id))
  const previous = await getData<DownloadJob>('musicplus_latest_download')
  if (previous?.id == id) await saveData('musicplus_latest_download', null)
  DeviceEventEmitter.emit(LIBRARY_EVENT)
})
let trackingCleanup: (() => void) | null = null
let discardActiveSession: (() => void) | null = null

export const clearListeningHistory = async() => write(async() => {
  discardActiveSession?.()
  const keys = (await getAllKeys()).filter(key => key == RECENT || key.startsWith(LISTENING_DAY_PREFIX))
  if (keys.length) await removeDataMultiple(keys)
  DeviceEventEmitter.emit(LIBRARY_EVENT)
})

export const startRecentTracking = () => {
  if (trackingCleanup) return trackingCleanup
  interface Session {
    music: LX.Music.MusicInfo
    listenedSeconds: number
    lastTickAt: number | null
    lastPosition: number | null
    ranges: Array<[number, number]>
    ratio: number
    timer: number | null
    completed: boolean
    eventId: string
    segmentDate: string
    segmentStartedAt: number
    segmentStartedHere: boolean
    segmentSeconds: number
    lastEventFlushAt: number
  }
  let session: Session | null = null
  let active = true
  const saveStats = async(music: LX.Music.MusicInfo, update: Partial<Omit<RecentTrack, 'music' | 'playedAt'>>, playedAt?: number) => {
    await write(async() => {
      const recent = await getRecentTracks()
      const existing = recent.find(item => item.music.id == music.id)
      const item: RecentTrack = {
        music,
        playedAt: playedAt ?? existing?.playedAt ?? Date.now(),
        firstPlayedAt: existing?.firstPlayedAt ?? playedAt ?? Date.now(),
        playCount: (existing?.playCount ?? 0) + (update.playCount ?? 0),
        listenedSeconds: (existing?.listenedSeconds ?? 0) + (update.listenedSeconds ?? 0),
        completedCount: (existing?.completedCount ?? 0) + (update.completedCount ?? 0),
        measuredSessions: (existing?.measuredSessions ?? 0) + (update.measuredSessions ?? 0),
        measuredListenedSeconds: (existing?.measuredListenedSeconds ?? 0) + (update.measuredListenedSeconds ?? 0),
        listenedRatioTotal: (existing?.listenedRatioTotal ?? 0) + (update.listenedRatioTotal ?? 0),
      }
      await saveData(RECENT, [item, ...recent.filter(entry => entry.music.id != music.id)].slice(0, 100))
      if (active) DeviceEventEmitter.emit(LIBRARY_EVENT)
    })
  }
  const persistSegment = (current: Session, force = false) => {
    const now = Date.now()
    if (!force && now - current.lastEventFlushAt < EVENT_FLUSH_MS) return
    current.lastEventFlushAt = now
    const date = current.segmentDate
    const snapshot: ListeningEventSegment = {
      id: current.eventId,
      startedAt: current.segmentStartedAt,
      track: trackSnapshot(current.music),
      listenedSeconds: current.segmentSeconds,
      completed: current.completed,
      startedHere: current.segmentStartedHere,
    }
    void write(async() => {
      const day = await getListeningDay(date)
      const index = day.events.findIndex(event => event.id == snapshot.id)
      const events = [...day.events]
      if (index >= 0) events[index] = snapshot
      else events.push(snapshot)
      await saveData(LISTENING_DAY_PREFIX + date, { version: 1, date, events })
      if (active) DeviceEventEmitter.emit(LIBRARY_EVENT)
    }).catch(() => {})
  }
  const musicInfo = () => {
    const original = playerState.playMusicInfo.musicInfo
    if (!original) return null
    return 'progress' in original ? original.metadata.musicInfo : original
  }
  const stopTimer = (current: Session) => {
    if (current.timer == null) return
    BackgroundTimer.clearInterval(current.timer)
    current.timer = null
  }
  const creditElapsed = (current: Session) => {
    if (current.lastTickAt == null) return
    const now = Date.now()
    const date = getListeningDayKey(now)
    if (date != current.segmentDate) {
      persistSegment(current, true)
      current.segmentDate = date
      current.segmentStartedAt = now
      current.segmentStartedHere = false
      current.segmentSeconds = 0
      current.lastEventFlushAt = 0
    }
    const elapsed = Math.min(MAX_LISTEN_TICK_SECONDS, Math.max(0, (now - current.lastTickAt) / 1000))
    current.lastTickAt = now
    const position = playerState.progress.nowPlayTime
    const previous = current.lastPosition
    current.lastPosition = position
    const delta = previous == null ? 0 : position - previous
    const rate = playerState.playRate > 0 ? playerState.playRate : 1
    // Require confirmed audio progress. Paused/buffering time and seek jumps
    // never become listening evidence; cap delayed background timer samples.
    if (!elapsed || previous == null || delta <= 0 || delta > elapsed * rate + 2) return
    const seconds = Math.min(elapsed, delta / rate)
    current.listenedSeconds += seconds
    current.ranges.push([previous, position])
    current.ranges.sort((a, b) => a[0] - b[0])
    const merged: Array<[number, number]> = []
    for (const range of current.ranges) {
      const last = merged[merged.length - 1]
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
      else merged.push([...range])
    }
    current.ranges = merged
    const duration = playerState.progress.maxPlayTime || parseDuration(current.music.interval)
    const coverage = merged.reduce((total, [start, end]) => total + Math.max(0, Math.min(end, duration) - Math.max(0, start)), 0)
    const ratio = duration > 0 ? Math.min(1, coverage / duration) : 0
    const ratioDelta = Math.max(0, ratio - current.ratio)
    current.ratio = Math.max(current.ratio, ratio)
    const completedCount = !current.completed && ratio >= 0.9 ? 1 : 0
    if (completedCount) current.completed = true
    current.segmentSeconds += seconds
    void saveStats(current.music, { listenedSeconds: seconds, measuredListenedSeconds: seconds, listenedRatioTotal: ratioDelta, completedCount }).catch(() => {})
    persistSegment(current)
  }
  const pauseSession = () => {
    if (!session) return
    if (musicInfo()?.id == session.music.id) creditElapsed(session)
    persistSegment(session, true)
    session.lastTickAt = null
    stopTimer(session)
  }
  const endSession = () => {
    pauseSession()
    session = null
  }
  const discardSession = () => {
    if (session) stopTimer(session)
    session = null
  }
  const onPlay = () => {
    if (!(settingState?.setting?.['player.isListeningStatsEnabled'] ?? true)) {
      discardSession()
      return
    }
    const music = musicInfo()
    if (!music) return
    if (session?.music.id != music.id) endSession()
    if (!session) {
      const now = Date.now()
      session = {
        music,
        listenedSeconds: 0,
        lastTickAt: null,
        lastPosition: null,
        ranges: [],
        ratio: 0,
        timer: null,
        completed: false,
        eventId: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        segmentDate: getListeningDayKey(now),
        segmentStartedAt: now,
        segmentStartedHere: true,
        segmentSeconds: 0,
        lastEventFlushAt: 0,
      }
      void saveStats(music, { playCount: 1, measuredSessions: 1 }, now).catch(() => {})
      persistSegment(session, true)
    } else {
      const now = Date.now()
      if (getListeningDayKey(now) != session.segmentDate) {
        persistSegment(session, true)
        session.segmentDate = getListeningDayKey(now)
        session.segmentStartedAt = now
        session.segmentStartedHere = false
        session.segmentSeconds = 0
        session.lastEventFlushAt = 0
      }
    }
    if (session.lastTickAt != null) return
    session.lastTickAt = Date.now()
    session.lastPosition = playerState.progress.nowPlayTime
    session.timer = BackgroundTimer.setInterval(() => {
      if (!playerState.isPlay || playerState.playMusicInfo.musicInfo?.id != session?.music.id) {
        pauseSession()
        return
      }
      if (session) creditElapsed(session)
    }, LISTEN_TICK_MS)
  }
  const onTrackChanged = () => {
    if (session?.music.id != musicInfo()?.id) endSession()
  }
  const onEnded = () => { endSession() }
  const onStop = () => { endSession() }
  const onSeek = () => {
    if (!session) return
    creditElapsed(session)
    session.lastPosition = null
  }
  const onSeekCompleted = (position: number) => {
    if (!session) return
    session.lastPosition = position
    if (session.lastTickAt != null) session.lastTickAt = Date.now()
  }
  const onSettingUpdated: typeof global.state_event.configUpdated = (keys, settings) => {
    if (!keys.includes('player.isListeningStatsEnabled')) return
    if (settings['player.isListeningStatsEnabled'] === false) discardSession()
  }
  const removeListeners = () => {
    endSession()
    active = false
    if (trackingCleanup == removeListeners) trackingCleanup = null
    if (discardActiveSession == discardSession) discardActiveSession = null
    global.app_event.off('play', onPlay)
    global.app_event.off('pause', pauseSession)
    global.app_event.off('musicToggled', onTrackChanged)
    global.app_event.off('playerEnded', onEnded)
    global.app_event.off('stop', onStop)
    global.app_event.off('error', pauseSession)
    global.app_event.off('playerWaiting', pauseSession)
    global.app_event.off('playerLoadstart', pauseSession)
    global.app_event.off('playerPlaying', onPlay)
    global.app_event.off('setProgress', onSeek)
    global.app_event.off('seekCompleted', onSeekCompleted)
    global.state_event.off('configUpdated', onSettingUpdated)
  }
  trackingCleanup = removeListeners
  discardActiveSession = discardSession
  global.app_event.on('play', onPlay)
  global.app_event.on('pause', pauseSession)
  global.app_event.on('musicToggled', onTrackChanged)
  global.app_event.on('playerEnded', onEnded)
  global.app_event.on('stop', onStop)
  global.app_event.on('error', pauseSession)
  global.app_event.on('playerWaiting', pauseSession)
  global.app_event.on('playerLoadstart', pauseSession)
  global.app_event.on('playerPlaying', onPlay)
  global.app_event.on('setProgress', onSeek)
  global.app_event.on('seekCompleted', onSeekCompleted)
  global.state_event.on('configUpdated', onSettingUpdated)
  if (playerState.isPlay) onPlay()
  return removeListeners
}

const parseDuration = (interval?: string | null) => {
  if (!interval || interval == '--/--') return 0
  const parts = interval.split(':').map(Number)
  if (parts.some(part => !Number.isFinite(part))) return 0
  return parts.reduce((total, part) => total * 60 + part, 0)
}
// Uses the existing playback engine/queue; no separate player for library entries.
export const playLibraryMusic = async(music: LX.Music.MusicInfo) => {
  await addListMusics(LIST_IDS.DEFAULT, [music], 'top')
  const songs = await getListMusics(LIST_IDS.DEFAULT)
  await playList(LIST_IDS.DEFAULT, songs.findIndex(item => item.id == music.id))
}
