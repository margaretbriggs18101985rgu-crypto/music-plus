import musicSdk from '@/utils/musicSdk'
import { toNewMusicInfo } from '@/utils'
import { searchArtist, type ArtistSearchResult } from '@/core/music/artist'
import type { ListInfoItem } from '@/store/songlist/state'
import { getOfficialSongInfo } from '@/core/music/officialInfo'
import wyMusicDetail from '@/utils/musicSdk/wy/musicDetail'

export type SearchSort = 'relevance' | 'hot' | 'newest'
export interface SearchSong { music: LX.Music.MusicInfoOnline, heat?: number, publishedAt?: number }
interface RawSearchSong { songmid: string | number, searchMetadata?: { heat?: unknown, publishedAt?: unknown } }
export interface CombinedSearch {
  songs: SearchSong[]
  playlists: ListInfoItem[]
  artists: ArtistSearchResult[]
  more: Record<string, boolean>
  pages: Record<string, number>
  failures: string[]
  page: number
}
const sources = ['wy', 'tx'] as const
const number = (value: unknown): number | undefined => {
  const result = Number(value)
  return value != null && value !== '' && Number.isFinite(result) && result >= 0 ? result : undefined
}
export const searchTimestamp = (value: unknown): number | undefined => {
  if (value == null || value === '' || value === 0) return
  const numeric = number(value)
  const result = numeric != null ? numeric < 10_000_000_000 ? numeric * 1000 : numeric : Date.parse(String(value))
  return Number.isFinite(result) && result > 0 ? result : undefined
}
const unique = <T>(list: T[], key: (item: T) => string) => [...new Map(list.map(item => [key(item), item])).values()]

export const searchCombined = async(text: string, page = 1, previous?: CombinedSearch): Promise<CombinedSearch> => {
  const result: CombinedSearch = {
    songs: page > 1 ? [...previous?.songs ?? []] : [],
    playlists: page > 1 ? [...previous?.playlists ?? []] : [],
    artists: page > 1 ? [...previous?.artists ?? []] : [],
    more: { ...previous?.more },
    pages: { ...previous?.pages },
    failures: [],
    page,
  }
  if (!text.trim()) return result
  const tasks = sources.flatMap(source => (['songs', 'playlists', 'artists'] as const).map(async kind => {
    const key = `${source}_${kind}`
    if (kind == 'artists') {
      if (page > 1) return
      const artist = await searchArtist(text, source)
      if (artist) result.artists.push(artist)
      return
    }
    if (page > 1 && previous?.more[key] === false) return
    try {
      const sourcePage = (page > 1 ? previous?.pages[key] ?? 0 : 0) + 1
      const response = kind == 'songs'
        ? await musicSdk[source].musicSearch.search(text, sourcePage, 20)
        : await musicSdk[source].songList.search(text, sourcePage, 12)
      if (!Array.isArray(response.list)) throw new Error('Invalid search response')
      const limit = kind == 'songs' ? 20 : 12
      result.more[key] = response.list.length > 0 && sourcePage * limit < response.total
      result.pages[key] = sourcePage
      if (kind == 'songs') {
        const rawSongs = response.list as RawSearchSong[]
        let details = new Map<string, RawSearchSong>()
        if (source == 'wy' && rawSongs.length) {
          try {
            const detail = await wyMusicDetail.getList(rawSongs.map(item => item.songmid))
            details = new Map((detail.list as RawSearchSong[]).map(item => [String(item.songmid), item]))
          } catch { /* Keep search results when optional metadata is unavailable. */ }
        }
        const songs = rawSongs.map(item => ({
          music: toNewMusicInfo(item) as LX.Music.MusicInfoOnline,
          heat: number(item.searchMetadata?.heat ?? details.get(String(item.songmid))?.searchMetadata?.heat),
          publishedAt: searchTimestamp(item.searchMetadata?.publishedAt ?? details.get(String(item.songmid))?.searchMetadata?.publishedAt),
        }))
        result.songs.push(...songs)
      } else result.playlists.push(...(response.list as ListInfoItem[]))
    } catch {
      result.failures.push(key)
      result.more[key] = true
    }
  }))
  await Promise.all(tasks)
  if (result.failures.length == 4 && !result.songs.length && !result.playlists.length && !result.artists.length) throw new Error('两平台搜索暂时不可用，请重试')
  result.songs = unique(result.songs, item => item.music.id)
  result.playlists = unique(result.playlists, item => `${item.source}_${item.id}`)
  result.artists.sort((a, b) => sources.indexOf(a.artist.source) - sources.indexOf(b.artist.source))
  return result
}

const dates = new Map<string, Promise<number | undefined>>()
export const enrichSearchDates = async(items: SearchSong[]): Promise<SearchSong[]> => {
  const result = [...items]
  let index = 0
  const worker = async() => {
    while (index < result.length) {
      const current = index++
      const item = result[current]
      if (item.publishedAt != null) continue
      let pending = dates.get(item.music.id)
      if (!pending) {
        pending = getOfficialSongInfo(item.music).then(info => searchTimestamp(info.published)).catch(() => undefined)
        dates.set(item.music.id, pending)
      }
      result[current] = { ...item, publishedAt: await pending }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker))
  return result
}

const normalize = (text: string) => text.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, '')
const relevance = (text: string, keyword: string) => {
  const query = normalize(keyword)
  const value = normalize(text)
  if (value == query) return 3
  return value.startsWith(query) ? 2 : value.includes(query) ? 1 : 0
}
const playCount = (value?: string) => {
  if (!value) return undefined
  const count = Number.parseFloat(value.replace(/,/g, ''))
  return Number.isFinite(count) ? count * (value.includes('亿') ? 100_000_000 : value.includes('万') ? 10_000 : 1) : undefined
}
// Cross-platform counters have different scales: compare their within-platform
// percentile. Unknown metrics sort last, with relevance as a stable tie-breaker.
export const sortSearchItems = <T>(items: T[], sort: SearchSort, keyword: string, fields: (item: T) => { source: string, text: string, heat?: number, publishedAt?: number }): T[] => {
  const entries = items.map((item, index) => ({ item, index, ...fields(item) }))
  const metric = (entry: typeof entries[number]) => {
    if (sort == 'newest') return entry.publishedAt
    if (sort != 'hot' || entry.heat == null) return undefined
    const peers = entries.filter(peer => peer.source == entry.source && peer.heat != null)
    return peers.filter(peer => peer.heat! < entry.heat!).length / Math.max(1, peers.length - 1)
  }
  return entries.sort((a, b) => {
    if (sort != 'relevance') {
      const left = metric(a)
      const right = metric(b)
      if (left == null && right != null) return 1
      if (left != null && right == null) return -1
      if (left != null && right != null && left != right) return right - left
    }
    return relevance(b.text, keyword) - relevance(a.text, keyword) || a.index - b.index
  }).map(entry => entry.item)
}
export const sortedSongs = (items: SearchSong[], sort: SearchSort, text: string) => sortSearchItems(items, sort, text, item => ({ source: item.music.source, text: `${item.music.name} ${item.music.singer}`, heat: item.heat, publishedAt: item.publishedAt }))
export const sortedPlaylists = (items: ListInfoItem[], sort: SearchSort, text: string) => sortSearchItems(items, sort, text, item => ({ source: item.source, text: item.name, heat: playCount(item.play_count), publishedAt: searchTimestamp(item.time) }))
