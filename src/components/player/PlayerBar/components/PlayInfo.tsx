import { useCallback, useState } from 'react'
import { View } from 'react-native'
import Progress, { ProgressPlain } from '@/components/player/Progress'
import Status from './Status'
import { useProgress } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { COMPONENT_IDS } from '@/config/constant'
import { usePageVisible } from '@/store/common/hook'
import { useBufferProgress } from '@/plugins/player'
import { useSettingValue } from '@/store/setting/hook'

export default ({ isHome }: { isHome: boolean }) => {
  const theme = useTheme()
  const [autoUpdate, setAutoUpdate] = useState(true)
  const { maxPlayTimeStr, nowPlayTimeStr, progress, maxPlayTime } = useProgress(autoUpdate)
  const buffered = useBufferProgress()
  const allowProgressBarSeek = useSettingValue('common.allowProgressBarSeek')
  usePageVisible([COMPONENT_IDS.home], useCallback((visible) => {
    if (isHome) setAutoUpdate(visible)
  }, [isHome]))

  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <View style={styles.status}><Status autoUpdate={autoUpdate} /></View>
        <Text size={9} color={theme['c-font-label']}>{nowPlayTimeStr} / {maxPlayTimeStr}</Text>
      </View>
      <View style={styles.progress}>
        {allowProgressBarSeek
          ? <Progress progress={progress} duration={maxPlayTime} buffered={buffered} />
          : <ProgressPlain progress={progress} duration={maxPlayTime} buffered={buffered} />}
      </View>
    </View>
  )
}

const styles = createStyle({
  container: { flexShrink: 0, paddingTop: 3 },
  info: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  status: { flex: 1 },
  progress: { height: 16, paddingVertical: 6 },
})
