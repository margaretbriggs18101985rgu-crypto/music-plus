import { getData, saveData } from '@/plugins/storage'

const KEY = 'musicplus_playback_sources_v1'
export const SOURCE_HISTORY_MS = 24 * 60 * 60 * 1000
export const SOURCE_COOLDOWN_MS = 2 * 60 * 1000
const TRACK_COOLDOWN_MS = 15 * 60 * 1000
const FAILURE_WINDOW_MS = 30 * 60 * 1000
const SOURCES = new Set(['kw', 'kg', 'tx', 'wy', 'mg'])

interface SourceRecord { api: string, source: string, successAt: number, failures: Array<{ track: string, at: number }>, until: number }
interface TrackRecord { api: string, track: string, source: string, id: string, successAt: number, failures: Array<{ source: string, until: number }> }
interface History { version: 1, sources: SourceRecord[], tracks: TrackRecord[] }
interface Options { load: () => Promise<unknown>, save: (history: History) => Promise<void>, now?: () => number }
const record = (value: unknown): value is Record<string, unknown> => value != null && typeof value == 'object' && !Array.isArray(value)
const keyText = (value: unknown): value is string => typeof value == 'string' && value.length > 0 && value.length <= 512

/** Local, bounded history, isolated by the selected custom API and platform. */
export const createSourceReliability = ({ load, save, now = Date.now }: Options) => {
  let sources: SourceRecord[] = []
  let tracks: TrackRecord[] = []
  const recentInfo = new Map<string, LX.Music.MusicInfoOnline>()
  let loading: Promise<void> | undefined
  let saving = Promise.resolve()
  const mapKey = (api: string, track: string) => JSON.stringify([api, track])
  const validTime = (value: unknown): value is number => typeof value == 'number' && Number.isFinite(value) && value >= 0 && value <= now()
  const prune = () => {
    sources = sources.filter(item => Math.max(item.successAt, ...item.failures.map(failure => failure.at)) > now() - SOURCE_HISTORY_MS).slice(-40)
    for (const item of sources) item.failures = item.failures.filter(failure => failure.at > now() - FAILURE_WINDOW_MS)
    tracks = tracks.filter(item => item.successAt > now() - SOURCE_HISTORY_MS || item.failures.some(failure => failure.until > now())).slice(-128)
    for (const item of tracks) item.failures = item.failures.filter(failure => failure.until > now())
    const retained = new Set(tracks.map(item => mapKey(item.api, item.track)))
    for (const key of recentInfo.keys()) if (!retained.has(key)) recentInfo.delete(key)
  }
  const persist = () => {
    prune()
    const snapshot: History = JSON.parse(JSON.stringify({ version: 1, sources, tracks }))
    saving = saving.then(async() => save(snapshot)).catch(error => { console.warn('Playback source history save failed', error) })
  }
  const ready = async() => {
    loading ??= load().then(value => {
      if (!record(value) || value.version !== 1) return
      if (Array.isArray(value.sources)) {
        for (const item of value.sources.slice(-40)) {
          if (!record(item) || !keyText(item.api) || typeof item.source != 'string' || !SOURCES.has(item.source) || !validTime(item.successAt)) continue
          if (sources.some(existing => existing.api == item.api && existing.source == item.source)) continue
          const failures = Array.isArray(item.failures) ? item.failures.filter((failure): failure is { track: string, at: number } =>
            record(failure) && keyText(failure.track) && validTime(failure.at)).slice(-3) : []
          sources.push({
            api: item.api,
            source: item.source,
            successAt: item.successAt,
            failures,
            until: typeof item.until == 'number' && Number.isFinite(item.until) && item.until <= now() + SOURCE_COOLDOWN_MS ? Math.max(0, item.until) : 0,
          })
        }
      }
      if (Array.isArray(value.tracks)) {
        for (const item of value.tracks.slice(-128)) {
          if (!record(item) || !keyText(item.api) || !keyText(item.track) || typeof item.source != 'string' ||
          (item.source !== '' && !SOURCES.has(item.source)) || typeof item.id != 'string' || item.id.length > 512 || !validTime(item.successAt)) continue
          if (tracks.some(existing => existing.api == item.api && existing.track == item.track)) continue
          const failures = Array.isArray(item.failures) ? item.failures.filter((failure): failure is { source: string, until: number } =>
            record(failure) && typeof failure.source == 'string' && SOURCES.has(failure.source) && typeof failure.until == 'number' &&
          Number.isFinite(failure.until) && failure.until > now() && failure.until <= now() + TRACK_COOLDOWN_MS).slice(-5) : []
          tracks.push({ api: item.api, track: item.track, source: item.source, id: item.id, successAt: item.successAt, failures })
        }
      }
      prune()
    }).catch(error => { console.warn('Playback source history load failed', error) })
    await loading
  }
  const sourceRecord = (api: string, source: string) => sources.find(item => item.api == api && item.source == source)
  const trackRecord = (api: string, track: string) => tracks.find(item => item.api == api && item.track == track)
  const blockedTrack = (api: string, track: string, source: string) =>
    trackRecord(api, track)?.failures.some(failure => failure.source == source && failure.until > now()) ?? false
  const blockedSource = (api: string, source: string) => (sourceRecord(api, source)?.until ?? 0) > now()
  const preferred = (api: string, track: string) => {
    const item = trackRecord(api, track)
    return item && item.successAt > now() - SOURCE_HISTORY_MS && item.source ? item : undefined
  }
  const sort = <T extends LX.Music.MusicInfo>(api: string, track: string, candidates: T[]): T[] => {
    const remembered = preferred(api, track)
    return candidates.map((info, index) => ({
      info,
      index,
      recent: remembered?.source == info.source && remembered.id == info.id,
      success: sourceRecord(api, info.source)?.successAt ?? 0,
    }))
      .sort((a, b) => Number(b.recent) - Number(a.recent) ||
        Number(b.success > now() - SOURCE_HISTORY_MS) - Number(a.success > now() - SOURCE_HISTORY_MS) || b.success - a.success || a.index - b.index)
      .map(item => item.info)
  }
  return {
    ready,
    blockedTrack,
    blockedSource,
    preferred,
    sort,
    remembered: (api: string, track: string) => preferred(api, track) ? recentInfo.get(mapKey(api, track)) : undefined,
    cooldownUntil: (api: string, source: string) => sourceRecord(api, source)?.until ?? 0,
    failure(api: string, track: string, source: string, songIdentity = track) {
      if (!SOURCES.has(source)) return
      prune()
      let item = sourceRecord(api, source)
      if (!item) { item = { api, source, successAt: 0, failures: [], until: 0 }; sources.push(item) }
      // Refreshing one bad song repeatedly cannot quarantine a whole platform.
      if (!item.failures.some(failure => failure.track == songIdentity)) item.failures.push({ track: songIdentity, at: now() })
      item.failures = item.failures.slice(-3)
      if (item.failures.length >= 3) item.until = now() + SOURCE_COOLDOWN_MS
      let entry = trackRecord(api, track)
      if (!entry) { entry = { api, track, source: '', id: '', successAt: 0, failures: [] }; tracks.push(entry) }
      entry.failures = [...entry.failures.filter(failure => failure.source != source), { source, until: now() + TRACK_COOLDOWN_MS }]
      persist()
    },
    success(api: string, track: string, info: LX.Music.MusicInfoOnline) {
      prune()
      sources = sources.filter(item => item.api != api || item.source != info.source)
      sources.push({ api, source: info.source, successAt: now(), failures: [], until: 0 })
      const previous = trackRecord(api, track)
      tracks = tracks.filter(item => item.api != api || item.track != track)
      tracks.push({
        api,
        track,
        source: info.source,
        id: info.id,
        successAt: now(),
        failures: previous?.failures.filter(failure => failure.source != info.source) ?? [],
      })
      recentInfo.set(mapKey(api, track), info)
      persist()
    },
    flush: async() => saving,
  }
}

export const playbackSources = createSourceReliability({ load: async() => getData(KEY), save: async history => saveData(KEY, history) })
