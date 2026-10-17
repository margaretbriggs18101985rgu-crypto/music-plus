import { httpFetch } from '@/utils/request'
import getWyMusicInfo from '@/utils/musicSdk/wy/musicInfo'
import { signRequest } from '@/utils/musicSdk/tx/utils'
import { resolveOfficialTrack } from './officialInfo'

export type ArtistSource = 'wy' | 'tx'
export interface Artist { source: ArtistSource, id: string, name: string, avatar?: string, cover?: string }
export interface ArtistProfile { artist: Artist, description: string, songCount?: number, albumCount?: number, songs: MusicPage }
export interface ArtistAlbum { source: ArtistSource, id: string, name: string, cover?: string, published?: string, count?: number }
export interface MusicPage { list: LX.Music.MusicInfoOnline[], more: boolean, total?: number, nextOffset?: number }
export interface AlbumPage { list: ArtistAlbum[], more: boolean, nextOffset?: number }
export interface ArtistBiography { summary: string, sections: Array<{ title: string, text: string }> }
export interface ArtistSearchResult { artist: Artist, aliases: string[], songCount?: number, albumCount?: number }
interface RawArtist { id?: number, mid?: string, name: string, picUrl?: string, img1v1Url?: string, briefDesc?: string, musicSize?: number, albumSize?: number, singer_id?: number, singer_mid?: string, singer_name?: string, singer_pic?: string, pic?: string, alias?: string[], alia?: string[], singer_trans?: string, song_num?: number, album_num?: number }
interface RawAlbum { id: number, mid?: string, name: string, picUrl?: string, publishTime?: number, size?: number }
interface RawSong {
  id: number
  mid?: string
  name: string
  title?: string
  ar?: RawArtist[]
  artists?: RawArtist[]
  singer?: RawArtist[]
  al?: RawAlbum
  album?: RawAlbum
  dt?: number
  duration?: number
  interval?: number
  hMusic?: { size: number }
  bMusic?: { size: number }
  sqMusic?: { size: number }
  hrMusic?: { size: number }
  h?: { size: number }
  l?: { size: number }
  sq?: { size: number }
  hr?: { size: number }
  file?: { media_mid: string, size_128mp3: number, size_320mp3: number, size_flac: number, size_hires: number }
}
interface WyArtistResponse { code: number, artist?: RawArtist, hotSongs?: RawSong[] }
interface WyAlbumsResponse { code: number, hotAlbums?: RawAlbum[], more?: boolean }
interface WyAlbumResponse { code: number, album?: RawAlbum & { songs?: RawSong[] }, songs?: RawSong[] }
interface QqSongsResponse { songList?: Array<{ songInfo: RawSong }>, totalNum?: number }
interface QqAlbumsResponse { albumList?: Array<{ albumMid: string, albumName: string, publishDate?: string, totalNum?: number }>, total?: number }

const platform = (source: ArtistSource) => source == 'wy' ? '网易云音乐' : 'QQ音乐'
const qqImage = (id: string, artist = false) => `https://y.gtimg.cn/music/photo_new/${artist ? 'T001' : 'T002'}R500x500M000${id}.jpg`
const date = (timestamp?: number) => timestamp && timestamp > 0 ? new Date(timestamp).toISOString().slice(0, 10) : undefined
const duration = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
const unique = <T extends { id: string }>(items: T[]) => [...new Map(items.map(item => [item.id, item])).values()]
const identities = new Map<string, { artist: Artist, expires: number }>()
const request = async <T>(url: string, source: ArtistSource): Promise<T> => {
  const response = await httpFetch(url, { headers: { Referer: source == 'wy' ? 'https://music.163.com/' : 'https://y.qq.com/' }, timeout: 15000 }).promise
  if (response.statusCode != 200) throw new Error(`${platform(source)}暂时无法访问，请重试`)
  return response.body as unknown as T
}
const qqRequest = async <T>(module: string, method: string, param: Record<string, string | number>): Promise<T> => {
  const query = encodeURIComponent(JSON.stringify({ comm: { ct: 24, cv: 0 }, req: { module, method, param } }))
  const body = await request<{ code: number, req?: { code: number, data?: T } }>(`https://u.y.qq.com/cgi-bin/musicu.fcg?data=${query}`, 'tx')
  if (body.code != 0 || body.req?.code != 0 || !body.req.data) throw new Error('QQ音乐资料获取失败，请重试')
  return body.req.data
}
const toArtist = (raw: RawArtist, source: ArtistSource): Artist => ({
  source,
  id: String(source == 'wy' ? raw.id ?? '' : raw.mid ?? ''),
  name: raw.name,
  avatar: source == 'wy' ? raw.img1v1Url ?? raw.picUrl : raw.mid ? qqImage(raw.mid, true) : undefined,
  cover: source == 'wy' ? raw.picUrl : raw.mid ? qqImage(raw.mid, true) : undefined,
})
// Keep platform IDs, media IDs and actual available qualities for the existing playback pipeline.
const toMusic = (raw: RawSong, source: ArtistSource): LX.Music.MusicInfoOnline => {
  const album = raw.al ?? raw.album
  const id = source == 'wy' ? raw.id : raw.mid!
  const sizes: Array<[LX.Quality, number | undefined]> = source == 'wy'
    ? [['128k', (raw.l ?? raw.bMusic)?.size], ['320k', (raw.h ?? raw.hMusic)?.size], ['flac', (raw.sq ?? raw.sqMusic)?.size], ['flac24bit', (raw.hr ?? raw.hrMusic)?.size]]
    : [['128k', raw.file?.size_128mp3], ['320k', raw.file?.size_320mp3], ['flac', raw.file?.size_flac], ['flac24bit', raw.file?.size_hires]]
  const qualitys: LX.Music.MusicQualityType[] = sizes.filter(([, bytes]) => bytes && bytes > 0).map(([type, bytes]) => ({ type, size: `${(bytes! / 1024 / 1024).toFixed(2)}M` }))
  const meta: LX.Music.MusicInfoMeta_online = {
    songId: id,
    albumId: source == 'wy' ? album?.id : album?.mid,
    albumName: album?.name ?? '',
    picUrl: source == 'wy' ? album?.picUrl : album?.mid ? qqImage(album.mid) : undefined,
    qualitys,
    _qualitys: Object.fromEntries(qualitys.map(({ type, size }) => [type, { size }])),
  }
  const common = { id: `${source}_${id}`, name: raw.title ?? raw.name, singer: (raw.ar ?? raw.artists ?? raw.singer ?? []).map(item => item.name).join('、'), interval: duration(source == 'wy' ? (raw.dt ?? raw.duration ?? 0) / 1000 : raw.interval ?? 0) }
  return source == 'tx'
    ? { ...common, source, meta: { ...meta, strMediaMid: raw.file?.media_mid ?? raw.mid!, id: raw.id, albumMid: album?.mid } }
    : { ...common, source, meta }
}
const songs = (raw: RawSong[], source: ArtistSource) => unique(raw.filter(item => source == 'wy' ? item.id > 0 : !!item.mid).map(item => toMusic(item, source)))
export const artistUrl = (artist: Artist) => artist.source == 'wy' ? `https://music.163.com/artist?id=${encodeURIComponent(artist.id)}` : `https://y.qq.com/n/ryqq/singer/${encodeURIComponent(artist.id)}`
export const albumUrl = (album: ArtistAlbum) => album.source == 'wy' ? `https://music.163.com/album?id=${encodeURIComponent(album.id)}` : `https://y.qq.com/n/ryqq/albumDetail/${encodeURIComponent(album.id)}`

export const getArtistIdentity = async(artist: Artist): Promise<Artist> => {
  if (artist.source == 'tx') return artist
  const cached = identities.get(`${artist.source}_${artist.id}`)
  if (cached && cached.expires > Date.now()) return cached.artist
  const body = await request<{ code: number, data?: { artist?: { id: number, name: string, avatar?: string, cover?: string } } }>(`https://music.163.com/api/artist/head/info/get?id=${encodeURIComponent(artist.id)}`, 'wy')
  const raw = body.data?.artist
  if (body.code != 200 || !raw?.id) throw new Error('歌手头像获取失败')
  const secure = (url?: string) => url?.replace(/^http:/, 'https:')
  const value: Artist = { ...artist, name: raw.name, avatar: secure(raw.avatar) ?? artist.avatar, cover: secure(raw.cover) ?? artist.cover }
  identities.set(`${artist.source}_${artist.id}`, { artist: value, expires: Date.now() + 300000 })
  return value
}

export const getTrackArtists = async(music: LX.Music.MusicInfo): Promise<Artist[]> => {
  const source = music.source == 'tx' ? 'tx' : 'wy'
  let target: LX.Music.MusicInfoOnline
  try { target = await resolveOfficialTrack(music, source) } catch (error) {
    if (music.source == 'wy' || music.source == 'tx') throw error
    target = await resolveOfficialTrack(music, 'tx')
  }
  let raw: RawArtist[] | undefined
  if (target.source == 'wy') {
    const detail = await (getWyMusicInfo(target.meta.songId).promise as unknown as Promise<RawSong>)
    raw = detail?.ar ?? detail?.artists
  } else {
    const detail = await qqRequest<{ track_info?: RawSong }>('music.pf_song_detail_svr', 'get_song_detail_yqq', { song_type: 0, song_mid: String(target.meta.songId) })
    raw = detail.track_info?.singer
  }
  const result = unique((raw ?? []).map(item => toArtist(item, target.source as ArtistSource)).filter(item => item.id && item.id != '0' && item.name))
  if (!result.length) throw new Error('暂未获取到这首歌的歌手资料，请重试')
  return result
}
const normalizeArtistQuery = (value: string) => value.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, '')
const matchArtist = (keyword: string, results: ArtistSearchResult[]): ArtistSearchResult | null => {
  const query = normalizeArtistQuery(keyword)
  if (!query) return null
  const score = ({ artist, aliases }: ArtistSearchResult) => {
    const name = normalizeArtistQuery(artist.name)
    const aliasNames = aliases.map(normalizeArtistQuery)
    if (name == query) return 3
    if (aliasNames.includes(query)) return 2
    if (name.includes(query)) return 1
    return aliasNames.some(alias => alias.includes(query)) ? 1 : 0
  }
  return results.map((item, index) => ({ item, index, score: score(item) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || (b.item.songCount ?? 0) - (a.item.songCount ?? 0) || a.index - b.index)[0]?.item ?? null
}
const toArtistSearchResult = (raw: RawArtist, source: ArtistSource): ArtistSearchResult => {
  const artist = source == 'tx'
    ? { source, id: String(raw.mid ?? raw.singer_mid ?? ''), name: raw.name ?? raw.singer_name ?? '', avatar: raw.pic ?? raw.singer_pic ?? (raw.mid ?? raw.singer_mid ? qqImage(raw.mid ?? raw.singer_mid!, true) : undefined) }
    : toArtist(raw, source)
  return { artist, aliases: raw.alias ?? raw.alia ?? (raw.singer_trans ? [raw.singer_trans] : []), songCount: raw.musicSize ?? raw.song_num, albumCount: raw.albumSize ?? raw.album_num }
}
const searchWyArtist = async(keyword: string): Promise<ArtistSearchResult | null> => {
  const body = await request<{ code: number, result?: { artists?: RawArtist[] } }>(`https://music.163.com/api/search/get/web?s=${encodeURIComponent(keyword)}&type=100&limit=10&offset=0`, 'wy')
  if (body.code != 200 || !Array.isArray(body.result?.artists)) return null
  return matchArtist(keyword, body.result.artists.map(item => toArtistSearchResult(item, 'wy')))
}
const searchQqArtist = async(keyword: string): Promise<ArtistSearchResult | null> => {
  let searchId = ''
  for (let index = 0; index < 32; index++) searchId += Math.floor(Math.random() * 16).toString(16)
  searchId = searchId.toUpperCase() + String(Math.floor(Math.random() * 100000)).padStart(5, '0')
  const response = await signRequest({
    comm: { _channelid: '0', _os_version: '6.2.9200-2', ct: '19', cv: '2151', guid: '1F70E520B2EAA7D25E11760783C53CA9', patch: '118', psrf_access_token_expiresAt: 0, psrf_qqaccess_token: '', psrf_qqopenid: '', psrf_qqunionid: '', tmeAppID: 'qqmusic', tmeLoginType: 0, uin: '0', wid: '7223299733393904640' },
    'music.search.SearchCgiService': {
      module: 'music.search.SearchCgiService',
      method: 'DoSearchForQQMusicDesktop',
      param: { grp: 1, num_per_page: 10, page_num: 1, query: keyword, remoteplace: 'txt.newclient.top', search_type: 0, searchid: searchId },
    },
  })
  const body = response.body as { code?: number, 'music.search.SearchCgiService'?: { code?: number, data?: { body?: { singer?: { list?: RawArtist[] } } } } }
  const result = body?.['music.search.SearchCgiService']
  if (body?.code != 0 || result?.code != 0 || !Array.isArray(result.data?.body?.singer?.list)) return null
  return matchArtist(keyword, result.data.body.singer.list.map(item => toArtistSearchResult(item, 'tx')))
}
export const searchArtist = async(keyword: string, preferredSource: LX.OnlineSource | 'all'): Promise<ArtistSearchResult | null> => {
  const query = keyword.trim()
  if (!query) return null
  if (preferredSource == 'tx') return await searchQqArtist(query).catch(() => null)
  const result = await searchWyArtist(query).catch(() => null)
  if (result != null || preferredSource == 'wy') return result
  return await searchQqArtist(query).catch(() => null)
}
export const getArtistSongs = async(artist: Artist, offset = 0, limit = 30): Promise<MusicPage> => {
  if (artist.source == 'wy') {
    const body = await request<WyArtistResponse>(`https://music.163.com/api/artist/${encodeURIComponent(artist.id)}`, 'wy')
    if (body.code != 200 || !Array.isArray(body.hotSongs)) throw new Error('网易云歌手歌曲获取失败，请重试')
    return { list: songs(body.hotSongs, 'wy'), more: false }
  }
  const body = await qqRequest<QqSongsResponse>('musichall.song_list_server', 'GetSingerSongList', { singerMid: artist.id, begin: offset, num: limit, order: 1 })
  if (!Array.isArray(body.songList)) throw new Error('QQ音乐歌手歌曲资料不完整')
  return { list: songs(body.songList.map(item => item.songInfo), 'tx'), nextOffset: offset + body.songList.length, more: body.songList.length > 0 && offset + body.songList.length < (body.totalNum ?? offset + body.songList.length + (body.songList.length == limit ? 1 : 0)), total: body.totalNum }
}
export const getArtistProfile = async(artist: Artist): Promise<ArtistProfile> => {
  if (artist.source == 'tx') {
    const page = await getArtistSongs(artist, 0, 50)
    return { artist, description: '', songCount: page.total, songs: { ...page, more: false } }
  }
  const body = await request<WyArtistResponse>(`https://music.163.com/api/artist/${encodeURIComponent(artist.id)}`, 'wy')
  if (body.code != 200 || !body.artist?.id || !Array.isArray(body.hotSongs)) throw new Error('网易云歌手资料获取失败，请重试')
  return { artist: toArtist(body.artist, 'wy'), description: body.artist.briefDesc ?? '', songCount: body.artist.musicSize, albumCount: body.artist.albumSize, songs: { list: songs(body.hotSongs.slice(0, 50), 'wy'), more: false } }
}
export const getArtistAllSongs = async(artist: Artist, offset = 0, limit = 100): Promise<MusicPage> => {
  if (artist.source == 'tx') return getArtistSongs(artist, offset, limit)
  const body = await request<{ code: number, songs?: RawSong[], more?: boolean, total?: number }>(`https://music.163.com/api/v1/artist/songs?id=${encodeURIComponent(artist.id)}&order=hot&offset=${offset}&limit=${limit}`, 'wy')
  if (body.code != 200 || !Array.isArray(body.songs)) throw new Error('网易云全部歌曲获取失败，请重试')
  return { list: songs(body.songs, 'wy'), more: body.songs.length > 0 && body.more === true, total: body.total, nextOffset: offset + body.songs.length }
}
export const getArtistBiography = async(artist: Artist): Promise<ArtistBiography> => {
  if (artist.source == 'tx') return { summary: '', sections: [] }
  const body = await request<{ code: number, briefDesc?: string, introduction?: Array<{ ti: string, txt: string }> }>(`https://music.163.com/api/artist/introduction?id=${encodeURIComponent(artist.id)}`, 'wy')
  if (body.code != 200) throw new Error('歌手简介获取失败，请重试')
  return { summary: body.briefDesc ?? '', sections: (body.introduction ?? []).map(item => ({ title: item.ti, text: item.txt })) }
}
export const getArtistAlbums = async(artist: Artist, offset = 0, limit = 20): Promise<AlbumPage> => {
  if (artist.source == 'wy') {
    const body = await request<WyAlbumsResponse>(`https://music.163.com/api/artist/albums/${encodeURIComponent(artist.id)}?offset=${offset}&limit=${limit}`, 'wy')
    if (body.code != 200 || !Array.isArray(body.hotAlbums)) throw new Error('网易云歌手专辑获取失败，请重试')
    return { list: unique(body.hotAlbums.map(item => ({ source: 'wy' as const, id: String(item.id), name: item.name, cover: item.picUrl, published: date(item.publishTime), count: item.size }))), nextOffset: offset + body.hotAlbums.length, more: body.hotAlbums.length > 0 && body.more === true }
  }
  const body = await qqRequest<QqAlbumsResponse>('music.musichallAlbum.AlbumListServer', 'GetAlbumList', { singerMid: artist.id, begin: offset, num: limit, order: 0 })
  if (!Array.isArray(body.albumList)) throw new Error('QQ音乐歌手专辑资料不完整')
  return { list: unique(body.albumList.map(item => ({ source: 'tx' as const, id: item.albumMid, name: item.albumName, cover: qqImage(item.albumMid), published: item.publishDate, count: item.totalNum && item.totalNum > 0 ? item.totalNum : undefined }))), nextOffset: offset + body.albumList.length, more: body.albumList.length > 0 && offset + body.albumList.length < (body.total ?? offset + body.albumList.length + (body.albumList.length == limit ? 1 : 0)) }
}
export const getAlbumSongs = async(album: ArtistAlbum, offset = 0, limit = 50): Promise<MusicPage> => {
  if (album.source == 'wy') {
    const body = await request<WyAlbumResponse>(`https://music.163.com/api/album/${encodeURIComponent(album.id)}`, 'wy')
    const list = body.songs ?? body.album?.songs
    if (body.code != 200 || !Array.isArray(list)) throw new Error('网易云专辑歌曲获取失败，请重试')
    return { list: songs(list, 'wy'), more: false, total: list.length }
  }
  const body = await qqRequest<QqSongsResponse>('music.musichallAlbum.AlbumSongList', 'GetAlbumSongList', { albumMid: album.id, albumID: 0, begin: offset, num: limit, order: 2 })
  if (!Array.isArray(body.songList)) throw new Error('QQ音乐专辑歌曲资料不完整')
  return { list: songs(body.songList.map(item => item.songInfo), 'tx'), nextOffset: offset + body.songList.length, more: body.songList.length > 0 && offset + body.songList.length < (body.totalNum ?? offset + body.songList.length + (body.songList.length == limit ? 1 : 0)), total: body.totalNum }
}
