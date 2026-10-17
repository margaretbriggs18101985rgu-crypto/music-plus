import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import CheckBox from '@/components/common/CheckBox'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import CheckBoxItem from '../../components/CheckBoxItem'
import SubTitle from '../../components/SubTitle'

// One named, checked accessibility node per control, using the existing checkbox visuals.
const Control = ({ label, checked, disabled = false, radio = false, onChange, children }: {
  label: string
  checked: boolean
  disabled?: boolean
  radio?: boolean
  onChange: () => void
  children: React.ReactNode
}) => <View accessible accessibilityRole={radio ? 'radio' : 'checkbox'} accessibilityLabel={label}
  accessibilityState={{ checked, disabled }} accessibilityActions={disabled ? [] : [{ name: 'activate' }]}
  onAccessibilityAction={({ nativeEvent }) => { if (!disabled && nativeEvent.actionName == 'activate') onChange() }}>
  <View importantForAccessibility="no-hide-descendants">{children}</View>
</View>

export default memo(() => {
  const t = useI18n()
  const enabled = useSettingValue('player.immersiveVisualsEnabled')
  const lyricMotion = useSettingValue('player.lyricMotionEnabled')
  const backgroundMotion = useSettingValue('player.backgroundMotion')
  const respectReducedMotion = useSettingValue('player.respectReducedMotion')
  const quality = useSettingValue('player.particleQuality')
  const switches = [
    { key: 'player.immersiveVisualsEnabled', check: enabled, label: t('setting_play_immersive_enabled'), disabled: false },
    { key: 'player.lyricMotionEnabled', check: lyricMotion, label: t('setting_play_immersive_lyric_motion'), disabled: !enabled },
    { key: 'player.backgroundMotion', check: backgroundMotion, label: t('setting_play_immersive_background_motion'), disabled: !enabled },
    { key: 'player.respectReducedMotion', check: respectReducedMotion, label: t('setting_play_immersive_reduced_motion'), disabled: !enabled },
  ] as const
  return <View style={styles.content}>
    {switches.map(({ key, check, label, disabled }) => <Control key={key} label={label} checked={check} disabled={disabled}
      onChange={() => { updateSetting({ [key]: !check }) }}>
      <CheckBoxItem label={label} check={check} disabled={disabled} marginBottom={8}
        helpDesc={key == 'player.immersiveVisualsEnabled' ? t('setting_play_immersive_help') : undefined}
        onChange={value => { updateSetting({ [key]: value }) }} />
    </Control>)}
    <SubTitle title={t('setting_play_immersive_particles')}>
      <View style={styles.qualities}>
        {(['auto', 'low', 'high', 'off'] as const).map(id => <Control key={id} radio label={t(`setting_play_immersive_${id}`)}
          checked={quality == id} disabled={!enabled} onChange={() => { updateSetting({ 'player.particleQuality': id }) }}>
          <CheckBox label={t(`setting_play_immersive_${id}`)} check={quality == id} disabled={!enabled} marginRight={8} need
            onChange={() => { updateSetting({ 'player.particleQuality': id }) }} />
        </Control>)}
      </View>
    </SubTitle>
  </View>
})

const styles = StyleSheet.create({
  content: { marginTop: 5 },
  qualities: { flexDirection: 'row', flexWrap: 'wrap' },
})
