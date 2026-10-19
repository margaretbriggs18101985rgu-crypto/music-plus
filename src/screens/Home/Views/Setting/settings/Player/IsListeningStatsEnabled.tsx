import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'
import CheckBoxItem from '../../components/CheckBoxItem'
import { createStyle } from '@/utils/tools'

export default memo(() => {
  const t = useI18n()
  const enabled = useSettingValue('player.isListeningStatsEnabled')
  return (
    <View style={styles.content}>
      <CheckBoxItem check={enabled} label={t('report_enable_stats')} onChange={value => { updateSetting({ 'player.isListeningStatsEnabled': value }) }} />
    </View>
  )
})

const styles = createStyle({
  content: { marginTop: 5 },
})
