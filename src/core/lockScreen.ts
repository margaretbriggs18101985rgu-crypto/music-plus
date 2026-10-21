import { NativeModules } from 'react-native'
import TrackPlayer, { Event, State } from 'react-native-track-player'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { subscribeLyrics, type Line } from '@/plugins/lyric'
import { defaultHeaders } from '@/components/common/Image'
import { matchLyricWords } from '@/utils/lyricWords'
import { parseReactiveVisuals } from '@/utils/reactiveVisuals'

const native = NativeModules.LockScreenLyrics as {
  setEnabled: (enabled: boolean) => void
  updatePlayer: (state: object) => void
}
const homeWidget = NativeModules.MusicHomeWidget as { updatePlayer: (state: object) => void } | undefined

/** Process-level subscription: works from Home and while the player screen is unmounted. */
export default () => {
  let enabled = settingState.setting['player.lockScreenLyrics']
  let lines: Line[] = []
  let lyrics: Array<{ time: number, text: string, translation: string, words: ReturnType<typeof matchLyricWords>[number] }> = []
  let activeLyric = -1
  let seekRevision = 0
  let playback = State.None
  let playbackRevision = 0

  const update = () => {
    const s = settingState.setting
    const music = playerState.musicInfo
    const hasTrack = !!playerState.playMusicInfo.musicInfo
    const widgetState = {
      trackId: music.id ?? '',
      title: music.name,
      artist: music.singer,
      artwork: hasTrack && music.pic ? music.pic.startsWith('/') ? `file://${music.pic}` : music.pic : null,
      artworkUserAgent: defaultHeaders['User-Agent'],
      hasTrack,
      isPlaying: hasTrack && playback == State.Playing,
      position: playerState.progress.nowPlayTime,
      duration: playerState.progress.maxPlayTime,
      seekRevision,
    }
    homeWidget?.updatePlayer(widgetState)
    if (!enabled) return
    native.updatePlayer({
      ...widgetState,
      isStopped: !hasTrack || playback == State.Stopped || playback == State.None,
      playbackRate: s['player.playbackRate'],
      status: playerState.statusText,
      lyrics,
      activeLyric,
      seekRevision,
      immersiveVisualsEnabled: s['player.immersiveVisualsEnabled'],
      reactiveVisuals: parseReactiveVisuals(s['player.reactiveVisuals']),
      particleQuality: s['player.particleQuality'],
      lyricMotionEnabled: s['player.lyricMotionEnabled'],
      lyricPulseEnabled: s['player.lyricPulseEnabled'],
      starPulseEnabled: s['player.starPulseEnabled'],
      lyricColor: s['player.lyricColor'],
      lyricFontSize: s['player.lyricFontSize'],
      lyricFontFamily: s['player.lyricFontFamily'],
      pageFontFamily: s['theme.pageFontFamily'],
      pageFontColor: s['theme.pageFontColor'],
      backgroundMotion: s['player.backgroundMotion'],
      respectReducedMotion: s['player.respectReducedMotion'],
      wallpaperPath: s['player.lockScreenWallpaper.path'],
      wallpaperKind: s['player.lockScreenWallpaper.kind'],
      wallpaperScope: 'player',
    })
  }
  const buildLyrics = () => {
    const words = matchLyricWords(lines, playerState.musicInfo.lxlrc ?? '')
    lyrics = lines.map((line, index) => ({ time: line.time, text: line.text, translation: line.extendedLyrics.join('\n'), words: words[index] }))
  }
  native.setEnabled(enabled)
  const unsubscribeLyrics = subscribeLyrics(value => { lines = value; buildLyrics(); update() }, line => { activeLyric = line; update() })
  const onMusic = () => { buildLyrics(); update() }
  const onTrack = () => { lines = []; lyrics = []; activeLyric = -1; update() }
  const onSeek = () => { seekRevision++; update() }
  const onSettings: typeof global.state_event.configUpdated = (keys) => {
    const next = settingState.setting['player.lockScreenLyrics']
    if (next != enabled) {
      enabled = next
      native.setEnabled(enabled)
      if (enabled) buildLyrics()
    }
    if (keys.some(key => key.startsWith('player.') || key.startsWith('theme.'))) update()
  }
  const playbackSubscription = TrackPlayer.addEventListener(Event.PlaybackState, data => {
    playbackRevision++
    playback = data.state as State
    update()
  })
  const revision = playbackRevision
  void TrackPlayer.getState().then(value => {
    if (revision != playbackRevision) return
    playback = value
    update()
  }).catch(error => { console.warn('Lock screen playback state unavailable', error) })
  global.state_event.on('playerMusicInfoChanged', onMusic)
  global.state_event.on('playMusicInfoChanged', onTrack)
  global.state_event.on('playProgressChanged', update)
  global.state_event.on('configUpdated', onSettings)
  global.app_event.on('seekCompleted', onSeek)
  return () => {
    enabled = false
    playbackRevision++
    unsubscribeLyrics()
    playbackSubscription.remove()
    global.state_event.off('playerMusicInfoChanged', onMusic)
    global.state_event.off('playMusicInfoChanged', onTrack)
    global.state_event.off('playProgressChanged', update)
    global.state_event.off('configUpdated', onSettings)
    global.app_event.off('seekCompleted', onSeek)
    native.setEnabled(false)
  }
}
