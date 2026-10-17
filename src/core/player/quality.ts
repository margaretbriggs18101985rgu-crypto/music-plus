import { getMusicUrl } from '@/core/music'
import { getPosition } from '@/plugins/player'
import { playMusic } from '@/plugins/player/playList'
import playerState from '@/store/player/state'
import { updateSetting } from '@/core/common'

/** Resolve first, then swap the stream at the real position without changing pause intent. */
export const switchCurrentQuality = async(quality: LX.Quality): Promise<boolean> => {
  const current = playerState.playMusicInfo.musicInfo
  if (!current) { updateSetting({ 'player.playQuality': quality }); return true }
  const musicInfo = 'progress' in current ? current.metadata.musicInfo : current
  if (musicInfo.source == 'local') throw new Error('本地音乐使用原文件音质')
  const url = await getMusicUrl({ musicInfo, quality, isRefresh: true, allowToggleSource: false })
  if (current !== playerState.playMusicInfo.musicInfo) return false
  const time = await getPosition()
  if (current !== playerState.playMusicInfo.musicInfo) return false
  await playMusic(current, url, time, playerState.isPlay)
  if (current !== playerState.playMusicInfo.musicInfo) return false
  updateSetting({ 'player.playQuality': quality })
  return true
}
