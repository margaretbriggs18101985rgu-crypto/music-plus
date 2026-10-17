import { TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { useIsPlay, usePlayMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { playPrev, togglePlay } from '@/core/player/player'
import { createStyle } from '@/utils/tools'
import { showPlaybackQueue } from '@/components/player/PlaybackQueue'
import { useHorizontalMode } from '@/utils/hooks'

const BTN_SIZE = 24
const handlePlayPrev = () => {
  void playPrev()
}

const PlayPrevBtn = () => {
  const theme = useTheme()
  const enabled = !!usePlayMusicInfo().musicInfo

  return (
    <TouchableOpacity disabled={!enabled} style={[styles.cotrolBtn, { opacity: enabled ? 1 : 0.35 }]} activeOpacity={0.5} onPress={handlePlayPrev} accessibilityRole="button" accessibilityLabel={global.i18n.t('ui_previous')}>
      <Icon name='prevMusic' color={theme['c-button-font']} size={BTN_SIZE} />
    </TouchableOpacity>
  )
}

const QueueBtn = () => {
  const theme = useTheme()
  return <TouchableOpacity style={styles.cotrolBtn} activeOpacity={0.5} onPress={showPlaybackQueue} accessibilityRole="button" accessibilityLabel="播放队列">
    <Icon name="menu" color={theme['c-font']} size={22} />
  </TouchableOpacity>
}

const TogglePlayBtn = () => {
  const isPlay = useIsPlay()
  const theme = useTheme()
  const enabled = !!usePlayMusicInfo().musicInfo

  return (
    <TouchableOpacity disabled={!enabled} style={[styles.cotrolBtn, { opacity: enabled ? 1 : 0.35 }]} activeOpacity={0.5} onPress={togglePlay} accessibilityRole="button" accessibilityLabel={global.i18n.t(isPlay ? 'ui_pause' : 'ui_play')}>
      <View style={[styles.playCircle, { borderColor: theme['c-font-label'] }]}>
        <Icon name={isPlay ? 'pause' : 'play'} color={theme['c-font']} size={15} />
      </View>
    </TouchableOpacity>
  )
}

export default () => {
  const isHorizontalMode = useHorizontalMode()
  return (
    <>
      {/* <TouchableOpacity activeOpacity={0.5} onPress={toggleNextPlayMode}>
        <Text style={{ ...styles.cotrolBtn }}>
          <Icon name={playModeIcon} style={{ color: theme.secondary10 }} size={18} />
        </Text>
      </TouchableOpacity>
    */}
      {/* {btnPrev} */}
      { isHorizontalMode ? <PlayPrevBtn /> : null }
      <TogglePlayBtn />
      <QueueBtn />
    </>
  )
}


const styles = createStyle({
  cotrolBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',

    // backgroundColor: '#ccc',
    shadowOpacity: 1,
    textShadowRadius: 1,
  },
  playCircle: { width: 33, height: 33, borderWidth: 1.5, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
})
