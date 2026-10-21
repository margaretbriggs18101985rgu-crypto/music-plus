import musicSdk from '@/utils/musicSdk'
import { toNewMusicInfo } from '@/utils'
import type { RecentTrack } from './library'
import type { ListInfoItem } from '@/store/songlist/state'
import type { Message } from '@/lang'

export interface Preference { id: string, weight: number }
export interface StylePreference extends Preference { averageDuration: number }
export interface ListeningProfile {
  artists: Array<Preference & { name: string }>
  languages: Preference[]
  styles: StylePreference[]
  albums: Array<Preference & { name: string }>
  averageDuration: number
  /** Weighted title/album terms used for item-to-item content recall. */
  tokens: Preference[]
  /** The strongest engaged tracks, used as local item-to-item seeds. */
  seedTracks: Array<{ id: string, features: TrackFeatures, weight: number }>
}
export interface RecommendedTrack { music: LX.Music.MusicInfo, reasons: Array<keyof Message> }
interface TrackSignals { name: string, singer: string, interval?: string | null, meta: { albumName?: string } }
interface TrackFeatures {
  artists: string[]
  album: string
  language: string
  styles: string[]
  tokens: string[]
  duration: number
}
interface CandidateContext { hits: number, bestRank: number, channels: Set<string> }

export const MAX_RECOMMENDED_SONGS = 20

const languageLabels: Record<string, string> = {
  zh: '华语',
  yue: '粤语',
  en: '欧美',
  ja: '日语',
  ko: '韩语',
}
const styleLabels: Record<string, string> = {
  rock: '摇滚',
  rap: '说唱',
  rnb: 'R&B',
  electronic: '电子',
  folk: '民谣',
  jazz: '爵士',
  classical: '古典',
  anime: 'ACG',
  instrumental: '纯音乐',
  pop: '流行',
  country: '乡村',
  metal: '金属',
}
const stylePatterns: Array<[string, RegExp]> = [
  ['rnb', /r\s*&\s*b|rnb|rhythm\s+and\s+blues|节奏布鲁斯/i],
  ['rap', /hip[ -]?hop|rap|说唱|嘻哈/i],
  ['rock', /rock|摇滚|后摇|朋克/i],
  ['electronic', /electronic|edm|techno|house|电子|电音|舞曲/i],
  ['folk', /folk|民谣|民歌/i],
  ['jazz', /jazz|爵士|蓝调|blues/i],
  ['classical', /classical|古典|交响|协奏曲/i],
  ['anime', /anime|acg|动漫|动画原声|二次元/i],
  ['instrumental', /instrumental|纯音乐|轻音乐|器乐|钢琴曲|无歌词/i],
  ['country', /country|乡村音乐/i],
  ['metal', /metal|金属乐/i],
  ['pop', /pop|流行乐|流行歌曲/i],
]
const artistSeparators = /、|&|;|；|\/|,|，|\|/g

const trackText = (music: TrackSignals) => `${music.name} ${music.singer} ${music.meta.albumName ?? ''}`
const normalize = (value: string) => value.toLocaleLowerCase().replace(/[\s.'’`()（）\u005b\u005d【】]/g, '')
const textTokens = (value: string) => {
  const parts = value.toLocaleLowerCase().match(/[a-z0-9]+|[\u3400-\u9fff]+/gi) ?? []
  const tokens: string[] = []
  for (const part of parts) {
    if (/^[\u3400-\u9fff]+$/.test(part)) {
      if (part.length > 1) tokens.push(part)
      for (let index = 0; index < part.length - 1; index++) tokens.push(part.slice(index, index + 2))
    } else if (part.length > 1) {
      tokens.push(part)
    }
  }
  return [...new Set(tokens)]
}

export const getTrackLanguage = (music: TrackSignals): string => {
  const text = trackText(music)
  if (/粤语|广东歌|cantopop/i.test(text)) return 'yue'
  if (/日语|日本語|j[ -]?pop|动漫歌曲|anime/i.test(text) || /[\u3040-\u30ff]/.test(text)) return 'ja'
  if (/韩语|한국어|k[ -]?pop/i.test(text) || /[\uac00-\ud7af]/.test(text)) return 'ko'
  if (/欧美|英文|英语|western|english/i.test(text)) return 'en'
  if (/国语|华语|中文|普通话|mandopop/i.test(text) || /[\u3400-\u9fff]/.test(text)) return 'zh'
  if (/[a-z]/i.test(text)) return 'en'
  return ''
}

export const getTrackStyles = (music: TrackSignals) => {
  const text = trackText(music)
  return stylePatterns.filter(([, pattern]) => pattern.test(text)).map(([id]) => id)
}

const trackDuration = (music: TrackSignals) => {
  if (!music.interval) return 0
  const parts = music.interval.split(':').map(Number)
  if (parts.some(part => !Number.isFinite(part))) return 0
  return parts.reduce((total, part) => total * 60 + part, 0)
}

const getTrackFeatures = (music: TrackSignals): TrackFeatures => ({
  artists: music.singer.split(artistSeparators).map(name => normalize(name.trim())).filter(Boolean),
  album: normalize(music.meta.albumName ?? ''),
  language: getTrackLanguage(music),
  styles: getTrackStyles(music),
  tokens: [...new Set([...textTokens(music.name), ...textTokens(music.meta.albumName ?? '')])],
  duration: trackDuration(music),
})

const getArtistKeys = (music: TrackSignals) => music.singer.split(artistSeparators).map(name => normalize(name.trim())).filter(Boolean)

const overlapScore = (left: string[], right: string[]) => {
  if (!left.length || !right.length) return 0
  const rightSet = new Set(right)
  const intersection = left.filter(item => rightSet.has(item)).length
  return intersection / Math.max(1, new Set([...left, ...right]).size)
}

/** Combines metadata similarity with recency-weighted seeds from engaged tracks; it does not train embeddings or use other listeners' data. */
const trackSimilarity = (left: TrackFeatures, right: TrackFeatures) => {
  const artist = overlapScore(left.artists, right.artists)
  const style = overlapScore(left.styles, right.styles)
  const token = overlapScore(left.tokens, right.tokens)
  const album = left.album && right.album && left.album == right.album ? 1 : 0
  const language = left.language && left.language == right.language ? 1 : 0
  return artist * 0.3 + style * 0.24 + token * 0.18 + album * 0.14 + language * 0.1
}

export const getListeningEvidence = (item: RecentTrack) => {
  const duration = trackDuration(item.music)
  const measured = (item.measuredSessions ?? 0) > 0
  const sessions = Math.max(1, measured ? item.measuredSessions! : item.playCount ?? 1)
  const seconds = Math.max(0, (measured ? item.measuredListenedSeconds : item.listenedSeconds) ?? 0)
  // Legacy cumulative time is divided by plays, never treated as one full listen.
  const ratio = Math.min(1, Math.max(0, measured
    ? (item.listenedRatioTotal ?? 0) / sessions
    : duration ? seconds / (sessions * duration) : 0))
  const averageSeconds = seconds / sessions
  const eligible = duration > 0 ? ratio >= 0.2 && averageSeconds >= Math.min(30, duration * 0.2) : averageSeconds >= 60
  return { sessions, seconds, ratio, eligible }
}

export const getRecommendationProfileKey = (recent: RecentTrack[]) => recent.flatMap(item => {
  const evidence = getListeningEvidence(item)
  return evidence.eligible ? [`${item.music.id}:${Math.floor(evidence.ratio * 4)}:${Math.floor(Math.log2(1 + evidence.seconds / 60))}:${Math.floor(item.playedAt / 86_400_000)}`] : []
}).sort().join('|')

export const getRecommendationSource = (recent: RecentTrack[]): 'wy' | 'tx' => {
  const weights = { wy: 0, tx: 0 }
  for (const item of recent) {
    const evidence = getListeningEvidence(item)
    if (evidence.eligible && (item.music.source == 'wy' || item.music.source == 'tx')) weights[item.music.source] += evidence.ratio * Math.log2(1 + evidence.seconds)
  }
  return weights.tx > weights.wy ? 'tx' : 'wy'
}

export const buildListeningProfile = (recent: RecentTrack[]): ListeningProfile => {
  const artists = new Map<string, { id: string, name: string, weight: number }>()
  const albums = new Map<string, { id: string, name: string, weight: number }>()
  const languages = new Map<string, number>()
  const styles = new Map<string, { weight: number, durationTotal: number, durationWeight: number }>()
  const tokens = new Map<string, number>()
  const seedTracks: Array<{ id: string, features: TrackFeatures, weight: number }> = []
  let durationTotal = 0
  let durationWeight = 0
  const orderedRecent = [...recent].sort((a, b) => b.playedAt - a.playedAt)
  for (const item of orderedRecent) {
    const evidence = getListeningEvidence(item)
    if (!evidence.eligible) continue
    const ageDays = Math.max(0, (Date.now() - item.playedAt) / 86_400_000)
    const recencyWeight = Math.max(0.25, 1 - ageDays / 120)
    const listenWeight = Math.min(2.5, Math.log2(1 + evidence.seconds / 60) * 0.65)
    const duration = trackDuration(item.music)
    const completionRatio = duration ? evidence.ratio : 0.5
    const repeatWeight = Math.min(1.5, Math.log2(1 + evidence.sessions * completionRatio) * 0.5)
    const weight = (1 + listenWeight + repeatWeight) * recencyWeight * completionRatio ** 2
    const features = getTrackFeatures(item.music)
    seedTracks.push({ id: item.music.id, features, weight })
    for (const token of features.tokens) tokens.set(token, (tokens.get(token) ?? 0) + weight)
    for (const rawArtist of item.music.singer.split(artistSeparators).map(name => name.trim()).filter(Boolean)) {
      const key = normalize(rawArtist)
      if (!key) continue
      const current = artists.get(key)
      artists.set(key, { id: key, name: current?.name ?? rawArtist, weight: (current?.weight ?? 0) + weight })
    }
    const albumName = item.music.meta.albumName?.trim()
    const albumKey = albumName ? normalize(albumName) : ''
    if (albumKey) {
      const current = albums.get(albumKey)
      albums.set(albumKey, { id: albumKey, name: current?.name ?? albumName, weight: (current?.weight ?? 0) + weight })
    }
    const language = getTrackLanguage(item.music)
    if (language) languages.set(language, (languages.get(language) ?? 0) + weight)
    const trackStyles = getTrackStyles(item.music)
    for (const style of trackStyles) {
      const current = styles.get(style) ?? { weight: 0, durationTotal: 0, durationWeight: 0 }
      current.weight += weight
      if (duration) {
        current.durationTotal += duration * weight
        current.durationWeight += weight
      }
      styles.set(style, current)
    }
    if (duration) {
      durationTotal += duration * weight
      durationWeight += weight
    }
  }
  const byWeight = <T extends string>(values: Map<T, number>) => [...values].map(([id, weight]) => ({ id, weight })).sort((a, b) => b.weight - a.weight)
  return {
    artists: [...artists.values()].sort((a, b) => b.weight - a.weight).slice(0, 6),
    languages: byWeight(languages),
    styles: [...styles].map(([id, stats]) => ({
      id,
      weight: stats.weight,
      averageDuration: stats.durationWeight ? stats.durationTotal / stats.durationWeight : 0,
    })).sort((a, b) => b.weight - a.weight),
    albums: [...albums.values()].sort((a, b) => b.weight - a.weight).slice(0, 4),
    averageDuration: durationWeight ? durationTotal / durationWeight : 0,
    tokens: byWeight(tokens).slice(0, 24),
    seedTracks: seedTracks.sort((a, b) => b.weight - a.weight).slice(0, 12),
  }
}

export const scoreRecommendedTrack = (music: TrackSignals, profile: ListeningProfile) => {
  const features = getTrackFeatures(music)
  const artistNames = features.artists
  const artistWeight = profile.artists.length ? profile.artists[0].weight : 0
  const artistMatch = artistWeight
    ? Math.min(1, profile.artists.reduce((score, artist, index) => score + (artistNames.includes(normalize(artist.name)) ? (artist.weight / artistWeight) * Math.pow(0.72, index) : 0), 0))
    : 0
  const language = features.language
  const languageWeight = profile.languages[0]?.weight ?? 0
  const languageMatch = languageWeight
    ? Math.min(1, profile.languages.reduce((score, item, index) => score + (item.id == language ? (item.weight / languageWeight) * Math.pow(0.7, index) : 0), 0))
    : 0
  const styles = features.styles
  const topStyleWeight = profile.styles[0]?.weight ?? 0
  const matchingStyles = profile.styles.filter(style => styles.includes(style.id))
  const styleMatch = topStyleWeight
    ? Math.min(1, matchingStyles.reduce((score, style) => score + style.weight / topStyleWeight, 0))
    : 0
  const duration = features.duration
  // Duration is a tie-breaker for listeners with a clear long-form preference;
  // it should not overpower language/style matches or affect unrelated genres.
  const durationMatch = duration && profile.averageDuration && matchingStyles.length && profile.averageDuration >= 300
    ? Math.max(0, 1 - Math.abs(duration - profile.averageDuration) / Math.max(profile.averageDuration, 180))
    : 0
  const albumMatch = profile.albums.some(album => features.album == normalize(album.name)) ? 1 : 0
  const tokenWeight = profile.tokens[0]?.weight ?? 0
  const tokenMatch = tokenWeight
    ? Math.min(1, profile.tokens.reduce((score, token, index) => score + (features.tokens.includes(token.id) ? token.weight / tokenWeight * Math.pow(0.86, index) : 0), 0))
    : 0
  const seedWeight = profile.seedTracks.reduce((sum, seed) => sum + seed.weight, 0)
  const contentMatch = seedWeight
    ? Math.min(1, profile.seedTracks.reduce((score, seed, index) => score + trackSimilarity(features, seed.features) * seed.weight * Math.pow(0.84, index), 0) / seedWeight)
    : 0
  // Artist identity is one signal among several. Content and item-to-item
  // similarity deliberately have comparable influence to avoid artist bubbles.
  return artistMatch * 3.2 + languageMatch * 1.8 + styleMatch * 2.3 + durationMatch * 0.8 + albumMatch * 0.9 + tokenMatch * 0.8 + contentMatch * 3.1
}

export const rankRecommendedTracks = (tracks: LX.Music.MusicInfo[], profile: ListeningProfile, explorationIds: ReadonlySet<string> = new Set(), candidateContexts: ReadonlyMap<string, CandidateContext> = new Map()): RecommendedTrack[] => {
  const ranked = [...tracks].map((music, index) => ({ music, score: scoreRecommendedTrack(music, profile), index, isExploration: explorationIds.has(music.id), context: candidateContexts.get(music.id) }))
  const artistCounts = new Map<string, number>()
  const albumCounts = new Map<string, number>()
  const selected: RecommendedTrack[] = []
  let explorationSelected = false
  while (selected.length < MAX_RECOMMENDED_SONGS && ranked.length) {
    let bestIndex = -1
    let bestScore = Number.NEGATIVE_INFINITY
    const hasCapacity = (candidate: typeof ranked[number]) => {
      const artistKeys = getArtistKeys(candidate.music)
      const albumKey = normalize(candidate.music.meta.albumName ?? '')
      return !artistKeys.some(key => (artistCounts.get(key) ?? 0) >= 2) && (!albumKey || (albumCounts.get(albumKey) ?? 0) < 2)
    }
    const explorationAvailable = ranked.some(candidate => {
      return candidate.isExploration && hasCapacity(candidate)
    })
    const personalizedAvailable = ranked.some(candidate => !candidate.isExploration && hasCapacity(candidate))
    const requireExploration = selected.length >= 4 && !explorationSelected && explorationAvailable
    for (let index = 0; index < ranked.length; index++) {
      const candidate = ranked[index]
      if (requireExploration && !candidate.isExploration) continue
      if (selected.length < 4 && personalizedAvailable && candidate.isExploration) continue
      const artistKeys = getArtistKeys(candidate.music)
      const albumKey = normalize(candidate.music.meta.albumName ?? '')
      if (artistKeys.some(key => (artistCounts.get(key) ?? 0) >= 2)) continue
      if (albumKey && (albumCounts.get(albumKey) ?? 0) >= 2) continue
      const candidateFeatures = getTrackFeatures(candidate.music)
      const similarityToSelected = selected.reduce((max, item) => Math.max(max, trackSimilarity(candidateFeatures, getTrackFeatures(item.music))), 0)
      const context = candidate.context
      const recallPrior = context
        ? Math.min(1, context.hits / 3) * 0.55 + Math.min(1, context.channels.size / 3) * 0.35 + Math.max(0, 1 - context.bestRank / 15) * 0.2
        : 0
      const diversityPenalty = artistKeys.reduce((total, key) => total + (artistCounts.get(key) ?? 0) * 0.85, 0) + (albumCounts.get(albumKey) ?? 0) * 0.5 + similarityToSelected * 0.95
      const score = candidate.score + recallPrior - diversityPenalty
      if (bestIndex < 0 || score > bestScore || (score == bestScore && candidate.index < ranked[bestIndex].index)) {
        bestScore = score
        bestIndex = index
      }
    }
    if (bestIndex < 0) break
    const [candidate] = ranked.splice(bestIndex, 1)
    const artistKeys = getArtistKeys(candidate.music)
    const albumKey = normalize(candidate.music.meta.albumName ?? '')
    for (const artistKey of artistKeys) artistCounts.set(artistKey, (artistCounts.get(artistKey) ?? 0) + 1)
    if (albumKey) albumCounts.set(albumKey, (albumCounts.get(albumKey) ?? 0) + 1)
    explorationSelected ||= candidate.isExploration
    selected.push({ music: candidate.music, reasons: getRecommendationReasons(candidate.music, profile) })
  }
  return selected
}

export const getRecommendationReasons = (music: LX.Music.MusicInfo, profile: ListeningProfile) => {
  const reasons: Array<keyof Message> = []
  const artists = getTrackFeatures(music).artists
  if (profile.artists.some(artist => artists.includes(normalize(artist.name)))) reasons.push('ui_recommend_reason_artist')
  if (getTrackLanguage(music) && getTrackLanguage(music) == profile.languages[0]?.id) reasons.push('ui_recommend_reason_language')
  if (getTrackStyles(music).includes(profile.styles[0]?.id ?? '')) reasons.push('ui_recommend_reason_style')
  return reasons.slice(0, 2)
}

export const rankRecommendedPlaylists = (playlists: ListInfoItem[], profile: ListeningProfile) => [...playlists].sort((a, b) => playlistScore(b, profile) - playlistScore(a, profile))

const playlistScore = (playlist: ListInfoItem, profile: ListeningProfile) => {
  const text = `${playlist.name} ${playlist.desc ?? ''} ${playlist.author ?? ''}`
  const normalized = normalize(text)
  return scoreRecommendedTrack({
    name: text,
    singer: profile.artists.filter(artist => normalized.includes(normalize(artist.name))).map(artist => artist.name).join('、'),
    interval: '',
    meta: { albumName: profile.albums.find(album => normalized.includes(normalize(album.name)))?.name ?? '' },
  }, profile)
}

const recommendationQueries = (recent: RecentTrack[], profile: ListeningProfile) => {
  const plans: Array<{ query: string, channel: string }> = []
  const add = (query: string, channel: string) => {
    const trimmed = query.trim()
    if (trimmed) plans.push({ query: trimmed, channel })
  }
  for (const artist of profile.artists.slice(0, 4)) add(artist.name, 'artist')
  const language = languageLabels[profile.languages[0]?.id ?? '']
  for (const style of profile.styles.slice(0, 2).map(style => styleLabels[style.id]).filter(Boolean)) add([style, language].filter(Boolean).join(' '), 'style')
  for (const album of profile.albums.slice(0, 2)) add(album.name, 'album')
  const seedTracks = recent
    .filter(item => getListeningEvidence(item).eligible)
    .sort((a, b) => b.playedAt - a.playedAt)
    .slice(0, 2)
    .map(item => `${item.music.name} ${item.music.singer}`.trim())
  for (const seed of seedTracks) add(seed, 'item-to-item')
  const explorationQueries = recent.length
    ? [...new Set([language ? `热门${language}` : '热门歌曲', '新歌推荐'])]
    : ['热门歌曲', '新歌推荐']
  for (const query of explorationQueries) add(query, 'exploration')
  const planByQuery = new Map<string, { query: string, channel: string }>()
  for (const plan of plans) if (!planByQuery.has(plan.query)) planByQuery.set(plan.query, plan)
  const uniquePlans = [...planByQuery.values()].slice(0, 12)
  return { uniqueQueries: uniquePlans.map(plan => plan.query), explorationQueries, plans: uniquePlans }
}

export const getRecommendedSongs = async(recent: RecentTrack[], source: LX.OnlineSource, excludedIds: string[] = [], page = 1): Promise<RecommendedTrack[]> => {
  const profile = buildListeningProfile(recent)
  const musicSearch = musicSdk[source]?.musicSearch
  if (!musicSearch?.search) return []
  const { plans } = recommendationQueries(recent, profile)
  const pages = page > 1 ? [page, 1] : [1]
  const requests = plans.flatMap(plan => pages.map(searchPage => ({ ...plan, searchPage })))
  const results = await Promise.allSettled(requests.map(({ query, searchPage }) => musicSearch.search(query, searchPage, 15)))
  if (results.every(result => result.status == 'rejected')) throw new Error('Song recommendations unavailable')
  const excluded = new Set([...recent.map(item => item.music.id), ...excludedIds])
  const candidates = new Map<string, LX.Music.MusicInfo>()
  const explorationCandidateIds = new Set<string>()
  const personalizedCandidateIds = new Set<string>()
  const candidateContexts = new Map<string, CandidateContext>()
  for (let index = 0; index < results.length; index++) {
    const result = results[index]
    if (result.status != 'fulfilled') continue
    const list = result.value?.list
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (!item || typeof item != 'object') continue
      let music: LX.Music.MusicInfoOnline
      try {
        music = toNewMusicInfo(item) as LX.Music.MusicInfoOnline
      } catch {
        continue
      }
      if (!music.id || !music.name || !music.singer || excluded.has(music.id)) continue
      candidates.set(music.id, music)
      const request = requests[index]
      const context = candidateContexts.get(music.id) ?? { hits: 0, bestRank: Number.MAX_SAFE_INTEGER, channels: new Set<string>() }
      context.hits += 1
      context.bestRank = Math.min(context.bestRank, list.indexOf(item))
      context.channels.add(request.channel)
      candidateContexts.set(music.id, context)
      if (request.channel == 'exploration') explorationCandidateIds.add(music.id)
      else personalizedCandidateIds.add(music.id)
    }
  }
  const explorationIds = new Set([...explorationCandidateIds].filter(id => !personalizedCandidateIds.has(id)))
  return rankRecommendedTracks([...candidates.values()], profile, explorationIds, candidateContexts)
}

export const getRecommendedPlaylists = async(recent: RecentTrack[], excludedIds: string[] = [], page = 1): Promise<ListInfoItem[]> => {
  const profile = buildListeningProfile(recent)
  const { plans, explorationQueries } = recommendationQueries(recent, profile)
  const personalizedQueries = [
    ...plans.filter(plan => plan.channel == 'style').slice(0, 2),
    ...plans.filter(plan => plan.channel == 'album').slice(0, 1),
    ...plans.filter(plan => plan.channel == 'item-to-item').slice(0, 1),
    ...plans.filter(plan => plan.channel == 'artist').slice(0, 1),
  ].slice(0, 4).map(plan => plan.query)
  const queries = [...new Set([...personalizedQueries, ...explorationQueries])]
  const pages = page > 1 ? [page, 1] : [1]
  const sources = [getRecommendationSource(recent), getRecommendationSource(recent) == 'wy' ? 'tx' : 'wy'] as const
  const requests = sources.flatMap(source => queries.flatMap(query => pages.map(searchPage => ({ source, query, searchPage }))))
  const results = await Promise.allSettled(requests.map(async({ source, query, searchPage }) => musicSdk[source].songList.search(query, searchPage, 15)))
  if (results.every(result => result.status == 'rejected')) throw new Error('Playlist recommendations unavailable')
  const excluded = new Set(excludedIds)
  const candidates = new Map<string, ListInfoItem>()
  const exploration = new Set<string>()
  results.forEach((result, index) => {
    if (result.status != 'fulfilled' || !Array.isArray(result.value?.list)) return
    const { source, query } = requests[index]
    for (const item of result.value.list as ListInfoItem[]) {
      if (!item?.id || !item.name || item.source != source) continue
      const key = `${source}_${item.id}`
      if (excluded.has(key)) continue
      candidates.set(key, item)
      if (explorationQueries.includes(query)) exploration.add(key)
    }
  })
  const ranked = rankRecommendedPlaylists([...candidates.values()], profile)
  const result: ListInfoItem[] = []
  const authors = new Map<string, number>()
  while (ranked.length && result.length < 8) {
    const exploreIndex = result.length == 4 ? ranked.findIndex(item => exploration.has(`${item.source}_${item.id}`) && (authors.get(item.author) ?? 0) < 2) : -1
    const [item] = ranked.splice(exploreIndex >= 0 ? exploreIndex : 0, 1)
    if (item.author && (authors.get(item.author) ?? 0) >= 2) continue
    result.push(item)
    if (item.author) authors.set(item.author, (authors.get(item.author) ?? 0) + 1)
  }
  return result
}

export const getTopLanguage = (profile: ListeningProfile) => profile.languages[0]?.id ?? ''
