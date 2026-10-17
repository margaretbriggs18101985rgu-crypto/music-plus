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
  averageDuration: number
}
export interface RecommendedTrack { music: LX.Music.MusicInfo, reasons: Array<keyof Message> }

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

const trackText = (music: LX.Music.MusicInfo) => `${music.name} ${music.singer} ${music.meta.albumName ?? ''}`
const normalize = (value: string) => value.toLocaleLowerCase().replace(/[\s.'’`()（）\u005b\u005d【】]/g, '')

export const getTrackLanguage = (music: LX.Music.MusicInfo): string => {
  const text = trackText(music)
  if (/粤语|广东歌|cantopop/i.test(text)) return 'yue'
  if (/日语|日本語|j[ -]?pop|动漫歌曲|anime/i.test(text) || /[\u3040-\u30ff]/.test(text)) return 'ja'
  if (/韩语|한국어|k[ -]?pop/i.test(text) || /[\uac00-\ud7af]/.test(text)) return 'ko'
  if (/国语|华语|中文|普通话|mandopop/i.test(text) || /[\u3400-\u9fff]/.test(text)) return 'zh'
  if (/[a-z]/i.test(text)) return 'en'
  return ''
}

export const getTrackStyles = (music: LX.Music.MusicInfo) => {
  const text = trackText(music)
  return stylePatterns.filter(([, pattern]) => pattern.test(text)).map(([id]) => id)
}

const trackDuration = (music: LX.Music.MusicInfo) => {
  if (!music.interval) return 0
  const parts = music.interval.split(':').map(Number)
  if (parts.some(part => !Number.isFinite(part))) return 0
  return parts.reduce((total, part) => total * 60 + part, 0)
}

export const buildListeningProfile = (recent: RecentTrack[]): ListeningProfile => {
  const artists = new Map<string, { id: string, name: string, weight: number }>()
  const languages = new Map<string, number>()
  const styles = new Map<string, { weight: number, durationTotal: number, durationWeight: number }>()
  let durationTotal = 0
  let durationWeight = 0
  for (const item of recent) {
    const ageDays = Math.max(0, (Date.now() - item.playedAt) / 86_400_000)
    const recencyWeight = Math.max(0.25, 1 - ageDays / 120)
    const listenWeight = Math.min(2.5, Math.log2(1 + (item.listenedSeconds ?? 0) / 60) * 0.65)
    const playWeight = Math.min(2, Math.log2(1 + (item.playCount ?? 0)) * 0.7)
    const weight = (0.5 + recencyWeight + listenWeight + playWeight) * recencyWeight
    for (const rawArtist of item.music.singer.split(artistSeparators).map(name => name.trim()).filter(Boolean)) {
      const key = normalize(rawArtist)
      if (!key) continue
      const current = artists.get(key)
      artists.set(key, { id: key, name: current?.name ?? rawArtist, weight: (current?.weight ?? 0) + weight })
    }
    const language = getTrackLanguage(item.music)
    if (language) languages.set(language, (languages.get(language) ?? 0) + weight)
    const trackStyles = getTrackStyles(item.music)
    const duration = trackDuration(item.music)
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
    averageDuration: durationWeight ? durationTotal / durationWeight : 0,
  }
}

export const scoreRecommendedTrack = (music: LX.Music.MusicInfo, profile: ListeningProfile) => {
  const artistNames = music.singer.split(artistSeparators).map(name => normalize(name.trim())).filter(Boolean)
  const artistWeight = profile.artists.length ? profile.artists[0].weight : 0
  const artistMatch = artistWeight ? Math.max(0, ...profile.artists.map(artist => artistNames.includes(normalize(artist.name)) ? artist.weight / artistWeight : 0)) : 0
  const language = getTrackLanguage(music)
  const languageMatch = language && language == profile.languages[0]?.id ? 1 : 0
  const styles = getTrackStyles(music)
  const topStyleWeight = profile.styles[0]?.weight ?? 0
  const matchingStyles = profile.styles.filter(style => styles.includes(style.id))
  const styleMatch = topStyleWeight ? Math.max(0, ...matchingStyles.map(style => style.weight / topStyleWeight)) : 0
  const duration = trackDuration(music)
  const longSongPreference = duration ? Math.max(0, ...matchingStyles.map(style => {
    const preferredLongness = Math.min(1, Math.max(0, (style.averageDuration - 300) / 180))
    const candidateLongness = Math.min(1, Math.max(0, (duration - 300) / 180))
    return (style.weight / (topStyleWeight || style.weight)) * preferredLongness * candidateLongness
  })) : 0
  return artistMatch * 4 + languageMatch * 2.5 + styleMatch * 2 + longSongPreference * 1.5
}

export const rankRecommendedTracks = (tracks: LX.Music.MusicInfo[], profile: ListeningProfile): RecommendedTrack[] => {
  const ranked = [...tracks].sort((a, b) => scoreRecommendedTrack(b, profile) - scoreRecommendedTrack(a, profile))
  const artistCounts = new Map<string, number>()
  const selected: RecommendedTrack[] = []
  for (const music of ranked) {
    const key = normalize(music.singer.split(artistSeparators)[0]?.trim() ?? '')
    if (key && (artistCounts.get(key) ?? 0) >= 2) continue
    if (key) artistCounts.set(key, (artistCounts.get(key) ?? 0) + 1)
    selected.push({ music, reasons: getRecommendationReasons(music, profile) })
    if (selected.length == 10) break
  }
  return selected
}

export const getRecommendationReasons = (music: LX.Music.MusicInfo, profile: ListeningProfile) => {
  const reasons: Array<keyof Message> = []
  const artists = music.singer.split(artistSeparators).map(name => normalize(name.trim()))
  if (profile.artists.some(artist => artists.includes(normalize(artist.name)))) reasons.push('ui_recommend_reason_artist')
  if (getTrackLanguage(music) && getTrackLanguage(music) == profile.languages[0]?.id) reasons.push('ui_recommend_reason_language')
  if (getTrackStyles(music).includes(profile.styles[0]?.id ?? '')) reasons.push('ui_recommend_reason_style')
  return reasons.slice(0, 2)
}

export const rankRecommendedPlaylists = (playlists: ListInfoItem[], profile: ListeningProfile) => [...playlists].sort((a, b) => playlistScore(b, profile) - playlistScore(a, profile))

const playlistScore = (playlist: ListInfoItem, profile: ListeningProfile) => {
  const text = `${playlist.name} ${playlist.desc ?? ''} ${playlist.author ?? ''}`
  const language = /粤语|广东歌|cantopop/i.test(text) ? 'yue'
    : /欧美|英文|英语|western|english/i.test(text) ? 'en'
      : /日语|日本|j[ -]?pop/i.test(text) ? 'ja'
        : /韩语|韩国|k[ -]?pop/i.test(text) ? 'ko'
          : /华语|中文|国语|粤语|mandopop/i.test(text) ? 'zh' : ''
  const styles = stylePatterns.filter(([, pattern]) => pattern.test(text)).map(([id]) => id)
  const artistMatch = profile.artists.some(artist => artist.name.length > 2 && text.toLocaleLowerCase().includes(artist.name.toLocaleLowerCase()))
  return (language && language == profile.languages[0]?.id ? 3 : 0) + (profile.styles.some(style => styles.includes(style.id)) ? 2 : 0) + (artistMatch ? 2 : 0)
}

export const getRecommendedSongs = async(recent: RecentTrack[], source: LX.OnlineSource, excludedIds: string[] = [], page = 1): Promise<RecommendedTrack[]> => {
  if (!recent.length) return []
  const profile = buildListeningProfile(recent)
  const musicSearch = musicSdk[source]?.musicSearch
  if (!musicSearch?.search) return []
  const queries = profile.artists.slice(0, 2).map(artist => artist.name)
  const language = languageLabels[profile.languages[0]?.id ?? '']
  const style = styleLabels[profile.styles[0]?.id ?? '']
  const tasteQuery = [style, language].filter(Boolean).join(' ')
  if (tasteQuery) queries.push(tasteQuery)
  else if (!queries.length && language) queries.push(language)
  const uniqueQueries = [...new Set(queries)].slice(0, 3)
  const pages = page > 1 ? [page, 1] : [1]
  const results = await Promise.allSettled(uniqueQueries.flatMap(query => pages.map(searchPage => musicSearch.search(query, searchPage, 15))))
  const excluded = new Set([...recent.map(item => item.music.id), ...excludedIds])
  const candidates = new Map<string, LX.Music.MusicInfo>()
  for (const result of results) {
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
    }
  }
  return rankRecommendedTracks([...candidates.values()], profile)
}

export const getTopLanguage = (profile: ListeningProfile) => profile.languages[0]?.id ?? ''
