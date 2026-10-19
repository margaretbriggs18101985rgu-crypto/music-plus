import { DeviceEventEmitter, NativeModules } from 'react-native'
import BackgroundTimer from 'react-native-background-timer'
import { getData, saveData } from '@/plugins/storage'
import playerState from '@/store/player/state'
import { addListMusics, getListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import { LIST_IDS } from '@/config/constant'

export const LIBRARY_EVENT = 'lx_musicLibraryUpdated'
export const OPEN_LIBRARY = 'lx_openLibraryPlaylist'
export interface RecentTrack {
  music: LX.Music.MusicInfo
  playedAt: number
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
const LISTEN_TICK_MS = 15_000
const MAX_LISTEN_TICK_SECONDS = 30
// Serialize read-modify-write operations, including rapid track changes and cover selection.
let writes: Promise<unknown> = Promise.resolve()
const write = async <T>(action: () => Promise<T>): Promise<T> => {
  const result = writes.then(action)
  writes = result.catch(() => {})
  return result
}
export const getRecentTracks = async() => await getData<RecentTrack[]>(RECENT) ?? []
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
export const startRecentTracking = () => {
  interface Session {
    music: LX.Music.MusicInfo
    listenedSeconds: number
    lastTickAt: number | null
    lastPosition: number | null
    ranges: Array<[number, number]>
    ratio: number
    timer: number | null
    completed: boolean
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
    void saveStats(current.music, { listenedSeconds: seconds, measuredListenedSeconds: seconds, listenedRatioTotal: ratioDelta, completedCount }).catch(() => {})
  }
  const pauseSession = () => {
    if (!session) return
    if (musicInfo()?.id == session.music.id) creditElapsed(session)
    session.lastTickAt = null
    stopTimer(session)
  }
  const endSession = () => {
    pauseSession()
    session = null
  }
  const onPlay = () => {
    const music = musicInfo()
    if (!music) return
    if (session?.music.id != music.id) endSession()
    if (!session) {
      session = { music, listenedSeconds: 0, lastTickAt: null, lastPosition: null, ranges: [], ratio: 0, timer: null, completed: false }
      void saveStats(music, { playCount: 1, measuredSessions: 1 }, Date.now()).catch(() => {})
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
  const removeListeners = () => {
    active = false
    endSession()
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
  }
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
