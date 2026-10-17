import { httpFetch } from '@/utils/request'
import getWyMusicInfo from '@/utils/musicSdk/wy/musicInfo'
import { getOtherSource } from '@/core/music/utils'

export interface OfficialSongInfo { source: '网易云音乐' | 'QQ音乐', name: string, artist: string, album: string, duration: string, published?: string, company?: string, language?: string, url: string }
interface WySong { id: number, name: string, ar: Array<{ name: string }>, al: { id: number, name: string }, dt: number }
interface WyAlbum { code: number, album: { publishTime: number, company?: string } }
interface QqDetail { code: number, req?: { code: number, data?: { track_info?: { title: string, mid: string, singer: Array<{ name: string }>, album: { name: string }, interval: number, time_public?: string, language?: string } } } }
const duration = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
export const resolveOfficialTrack = async(music: LX.Music.MusicInfo, source: 'wy' | 'tx'): Promise<LX.Music.MusicInfoOnline> => {
  if (music.source == source) return music
  const match = (await getOtherSource(music)).find(item => item.source == source)
  if (!match) throw new Error(`未在${source == 'wy' ? '网易云音乐' : 'QQ音乐'}匹配到该歌曲`)
  return match
}
export const getOfficialSongInfo = async(music: LX.Music.MusicInfo): Promise<OfficialSongInfo> => {
  let target = music
  if (target.source != 'wy' && target.source != 'tx') {
    const matches = await getOtherSource(music)
    const official = matches.find(item => item.source == 'wy' || item.source == 'tx')
    if (!official) throw new Error('未在网易云或QQ音乐匹配到该歌曲')
    target = official
  }
  if (target.source == 'wy') {
    const item = await (getWyMusicInfo(target.meta.songId).promise as unknown as Promise<WySong>)
    if (!item?.id || !Array.isArray(item.ar) || !item.al) throw new Error('网易云歌曲资料不完整')
    const result: OfficialSongInfo = {
      source: '网易云音乐',
      name: item.name,
      artist: item.ar.map((artist: { name: string }) => artist.name).join('、'),
      album: item.al.name,
      duration: duration(item.dt / 1000),
      url: `https://music.163.com/song?id=${item.id}`,
    }
    try {
      const response = await httpFetch(`https://music.163.com/api/album/${item.al.id}`, { headers: { Referer: 'https://music.163.com/' } }).promise
      const body = response.body as unknown as WyAlbum
      if (body.code == 200) {
        const album = body.album
        if (album.publishTime > 0) {
          const date = new Date(album.publishTime)
          result.published = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        }
        result.company = album.company ?? undefined
      }
    } catch {}
    return result
  }
  const data = { comm: { ct: 24, cv: 0 }, req: { module: 'music.pf_song_detail_svr', method: 'get_song_detail_yqq', param: { song_type: 0, song_mid: String(target.meta.songId) } } }
  const response = await httpFetch(`https://u.y.qq.com/cgi-bin/musicu.fcg?data=${encodeURIComponent(JSON.stringify(data))}`, { headers: { Referer: 'https://y.qq.com/' } }).promise
  const body = response.body as unknown as QqDetail
  if (body.code != 0 || body.req?.code != 0 || !body.req?.data?.track_info) throw new Error('QQ音乐歌曲资料获取失败')
  const item = body.req.data.track_info
  return {
    source: 'QQ音乐',
    name: item.title,
    artist: item.singer.map((artist: { name: string }) => artist.name).join('、'),
    album: item.album.name,
    duration: duration(item.interval),
    published: item.time_public ?? undefined,
    language: item.language ?? undefined,
    url: `https://y.qq.com/n/ryqq/songDetail/${item.mid}`,
  }
}
