import {
  play as lrcPlay,
  setLyric as lrcSetLyric,
  pause as lrcPause,
  setPlaybackRate as lrcSetPlaybackRate,
  toggleTranslation as lrcToggleTranslation,
  toggleRoma as lrcToggleRoma,
  init as lrcInit,
} from '@/plugins/lyric'
import {
  playDesktopLyric,
  setDesktopLyric,
  pauseDesktopLyric,
  setDesktopLyricPlaybackRate,
  toggleDesktopLyricTranslation,
  toggleDesktopLyricRoma,
} from '@/core/desktopLyric'
import { getPosition } from '@/plugins/player'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { updateNowPlayingTitles } from '@/plugins/player/utils'

let positionRevision = 0
let lyricAnchor: { time: number, at: number } | null = null

/**
 * init lyric
 */
export const init = async() => {
  return lrcInit()
}

/**
 * set lyric
 * @param lyric lyric str
 * @param translation lyric translation
 */
const handleSetLyric = async(lyric: string, translation = '', romalrc = '') => {
  lrcSetLyric(lyric, translation, romalrc)
  await setDesktopLyric(lyric, translation, romalrc)
  if (settingState.setting['player.isShowBluetoothFullLyric']) {
    void updateNowPlayingTitles({
      lyric,
    })
  }
}

/**
 * play lyric
 * @param time play time
 */
export const handlePlay = (time: number) => {
  lyricAnchor = { time, at: Date.now() }
  lrcPlay(time)
  void playDesktopLyric(time)
}

/**
 * pause lyric
 */
export const pause = () => {
  positionRevision++
  lyricAnchor = null
  lrcPause()
  void pauseDesktopLyric()
}

/**
 * stop lyric
 */
export const stop = () => {
  positionRevision++
  lyricAnchor = null
  void handleSetLyric('')
}

/** Audio is the master clock, including during buffering, pauses and failed seeks. */
export const syncPosition = (seconds: number, force = false) => {
  if (!Number.isFinite(seconds)) return
  const time = seconds * 1000
  const expected = lyricAnchor && lyricAnchor.time + (playerState.isPlay ? (Date.now() - lyricAnchor.at) * settingState.setting['player.playbackRate'] : 0)
  if (!force && expected != null && Math.abs(expected - time) < 200) return
  positionRevision++
  handlePlay(time)
  if (!playerState.isPlay) pause()
}

/**
 * set playback rate
 * @param playbackRate playback rate
 */
export const setPlaybackRate = async(playbackRate: number) => {
  lrcSetPlaybackRate(playbackRate)
  await setDesktopLyricPlaybackRate(playbackRate)
  if (playerState.isPlay) {
    play()
  }
}

/**
 * toggle show translation
 * @param isShowTranslation is show translation
 */
export const toggleTranslation = async(isShowTranslation: boolean) => {
  lrcToggleTranslation(isShowTranslation)
  await toggleDesktopLyricTranslation(isShowTranslation)
  if (playerState.isPlay) play()
}

/**
 * toggle show roma lyric
 * @param isShowLyricRoma is show roma lyric
 */
export const toggleRoma = async(isShowLyricRoma: boolean) => {
  lrcToggleRoma(isShowLyricRoma)
  await toggleDesktopLyricRoma(isShowLyricRoma)
  if (playerState.isPlay) play()
}

export const play = () => {
  const revision = ++positionRevision
  const id = playerState.musicInfo.id
  void getPosition().then((position) => {
    if (revision != positionRevision || id != playerState.musicInfo.id || !playerState.isPlay) return
    syncPosition(position, true)
  }).catch(error => { console.warn('Lyric clock unavailable', error) })
}


export const setLyric = async() => {
  if (!playerState.musicInfo.id) return
  await handleSetLyric(playerState.musicInfo.lrc ?? '', playerState.musicInfo.tlrc ?? '', playerState.musicInfo.rlrc ?? '')

  if (playerState.isPlay) play()
}
