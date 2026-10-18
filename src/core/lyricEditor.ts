import { clearEditedLyric, getPlayerLyric, saveEditedLyric } from '@/utils/data'
import playerState from '@/store/player/state'
import playerActions from '@/store/player/action'
import { setLyric, syncPosition } from '@/core/lyric'
import { getPosition } from '@/plugins/player'

export const MAX_LYRIC_LENGTH = 200000
export const validateEditedLyric = (info: LX.Music.LyricInfo) => {
  for (const text of [info.lyric, info.tlyric ?? '', info.rlyric ?? '']) {
    if (typeof text != 'string' || text.length > MAX_LYRIC_LENGTH) throw new Error('歌词过长，请限制每项在 20 万字以内')
  }
  if (!/\[\d{1,3}:[0-5]?\d(?:[.:]\d{1,3})?\]/.test(info.lyric)) throw new Error('歌词需要包含时间标记，例如 [00:12.34]歌词内容')
  for (const text of [info.tlyric, info.rlyric]) {
    if (text?.trim() && !/\[\d{1,3}:[0-5]?\d(?:[.:]\d{1,3})?\]/.test(text)) throw new Error('翻译和罗马音歌词也需要包含 LRC 时间标记，或留空')
  }
}

const applyLyric = async(track: LX.Music.MusicInfo, info: LX.Music.LyricInfo) => {
  if (playerState.playMusicInfo.musicInfo?.id != track.id) return false
  playerActions.setMusicInfo({ lrc: info.lyric, tlrc: info.tlyric ?? null, rlrc: info.rlyric ?? null, lxlrc: null })
  await setLyric()
  const position = await getPosition()
  if (playerState.playMusicInfo.musicInfo?.id != track.id) return false
  syncPosition(position, true)
  return true
}

export const saveCurrentEditedLyric = async(track: LX.Music.MusicInfo, info: LX.Music.LyricInfo) => {
  if (playerState.playMusicInfo.musicInfo?.id != track.id) throw new Error('歌曲已切换，请重新打开歌词编辑')
  validateEditedLyric(info)
  await saveEditedLyric(track, { lyric: info.lyric, tlyric: info.tlyric, rlyric: info.rlyric })
  return applyLyric(track, info)
}

export const resetCurrentEditedLyric = async(track: LX.Music.MusicInfo) => {
  if (playerState.playMusicInfo.musicInfo?.id != track.id) throw new Error('歌曲已切换，请重新打开歌词编辑')
  const { rawlrcInfo } = await getPlayerLyric(track)
  if (playerState.playMusicInfo.musicInfo?.id != track.id) throw new Error('歌曲已切换，请重新打开歌词编辑')
  const raw = { ...rawlrcInfo, lyric: rawlrcInfo.lyric.length ? rawlrcInfo.lyric : playerState.musicInfo.rawlrc ?? '' }
  await clearEditedLyric(track)
  await applyLyric(track, raw)
  return raw
}
