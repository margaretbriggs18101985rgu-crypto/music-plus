import { playNext, setMusicUrl } from '@/core/player/player'
import { setStatusText } from '@/core/player/playStatus'
import { getPosition, isEmpty, setStop } from '@/plugins/player'
import { isActive } from '@/utils/tools'
import BackgroundTimer from 'react-native-background-timer'
import playerState from '@/store/player/state'
import { setNowPlayTime } from '@/core/player/progress'
import { withPlaybackTimeout } from '@/core/player/urlResolver'


export default () => {
  let retryNum = 0
  let recoverySelection: typeof playerState.playMusicInfo | null = null

  let loadingTimeout: number | null = null
  let delayNextTimeout: number | null = null
  const startLoadingTimeout = () => {
    clearLoadingTimeout()
    const selection = playerState.playMusicInfo
    loadingTimeout = BackgroundTimer.setTimeout(() => {
      loadingTimeout = null
      if (playerState.playMusicInfo !== selection) return
      handleError()
    }, 25000)
  }
  const clearLoadingTimeout = () => {
    if (!loadingTimeout) return
    // console.log('clear load timeout')
    BackgroundTimer.clearTimeout(loadingTimeout)
    loadingTimeout = null
  }

  const clearDelayNextTimeout = () => {
    // console.log(this.delayNextTimeout)
    if (!delayNextTimeout) return
    BackgroundTimer.clearTimeout(delayNextTimeout)
    delayNextTimeout = null
  }
  const addDelayNextTimeout = () => {
    clearDelayNextTimeout()
    delayNextTimeout = BackgroundTimer.setTimeout(() => {
      if (global.lx.isPlayedStop) {
        setStatusText('')
        return
      }
      void playNext(true)
    }, 5000)
  }

  const handleLoadstart = () => {
    console.log('handleLoadstart', playerState.isPlay)
    if (global.lx.isPlayedStop || !playerState.playMusicInfo.musicInfo) return
    startLoadingTimeout()
    setStatusText(global.i18n.t('player__loading'))
  }

  // const handleLoadeddata = () => {
  //   setStatusText(global.i18n.t('player__loading'))
  // }

  // const handleCanplay = () => {
  //   setStatusText('')
  // }

  const handlePlaying = () => {
    setStatusText('')
    clearLoadingTimeout()
    clearDelayNextTimeout()
  }

  const handleEmpied = () => {
    clearDelayNextTimeout()
    clearLoadingTimeout()
  }

  const handleWating = () => {
    if (global.lx.isPlayedStop || !playerState.playMusicInfo.musicInfo) return
    setStatusText(global.i18n.t('player__buffering'))
    if (!loadingTimeout) startLoadingTimeout()
  }

  const handleError = () => {
    if (!playerState.musicInfo.id) return
    // Native error + track-load rejection can report the same failure twice.
    if (recoverySelection === playerState.playMusicInfo || global.lx.gettingUrlId) return
    clearLoadingTimeout()
    if (global.lx.isPlayedStop) return
    const playing = playerState.playMusicInfo.musicInfo
    const original = playing && ('progress' in playing ? playing.metadata.musicInfo : playing)
    // Online attempts are bounded by the resolver's per-source budget. Keep
    // the original two retries for local-file/tag resolution.
    if (playing && original && (original.source != 'local' || original.meta.toggleMusicInfo != null || retryNum < 2)) {
      const selection = playerState.playMusicInfo
      const musicInfo = selection.musicInfo!
      const toggleSource = original.meta.toggleMusicInfo
      const isCurrent = () => playerState.playMusicInfo === selection &&
        original.meta.toggleMusicInfo === toggleSource && !global.lx.isPlayedStop
      recoverySelection = selection
      retryNum++
      void withPlaybackTimeout(getPosition(), 1000).then((position) => {
        if (isCurrent() && Number.isFinite(position) && position >= 0) setNowPlayTime(position)
      }).catch(() => {
        // Position lookup must not block recovery if the native player failed.
      }).finally(() => {
        if (recoverySelection === selection) recoverySelection = null
        if (!isCurrent()) return
        setMusicUrl(musicInfo, true)
      })
      return
    }
    if (!isEmpty()) void setStop()

    if (isActive()) {
      setStatusText(global.i18n.t('player__error'))
      setTimeout(addDelayNextTimeout)
    } else {
      console.warn('error skip to next')
      void playNext(true)
    }
  }

  const handleSetPlayInfo = () => {
    retryNum = 0
    recoverySelection = null
    clearDelayNextTimeout()
    clearLoadingTimeout()
  }

  // const handlePlayedStop = () => {
  //   clearDelayNextTimeout()
  //   clearLoadingTimeout()
  // }


  global.app_event.on('playerLoadstart', handleLoadstart)
  // global.app_event.on('playerLoadeddata', handleLoadeddata)
  // global.app_event.on('playerCanplay', handleCanplay)
  global.app_event.on('playerPlaying', handlePlaying)
  global.app_event.on('playerWaiting', handleWating)
  global.app_event.on('playerEmptied', handleEmpied)
  global.app_event.on('playerError', handleError)
  global.app_event.on('musicToggled', handleSetPlayInfo)
  global.app_event.on('stop', handleSetPlayInfo)
}
