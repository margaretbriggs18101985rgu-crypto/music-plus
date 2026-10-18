import { memo } from 'react'
import { StyleSheet, View, TouchableOpacity } from 'react-native'
import CheckBox from '@/components/common/CheckBox'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import CheckBoxItem from '../../components/CheckBoxItem'
import SubTitle from '../../components/SubTitle'
import InputItem from '../../components/InputItem'
import { normalizeLyricColor } from '@/utils/lyricAppearance'
import { toast } from '@/utils/tools'

const lyricColors = [
  { color: '#A8F6FF', label: 'setting_play_lyric_color_0' },
  { color: '#FFFFFF', label: 'setting_play_lyric_color_1' },
  { color: '#FFE7A6', label: 'setting_play_lyric_color_2' },
  { color: '#FF9FCF', label: 'setting_play_lyric_color_3' },
  { color: '#9CFFDF', label: 'setting_play_lyric_color_4' },
  { color: '#C7B3FF', label: 'setting_play_lyric_color_5' },
] as const

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
  const lyricPulse = useSettingValue('player.lyricPulseEnabled')
  const backgroundMotion = useSettingValue('player.backgroundMotion')
  const respectReducedMotion = useSettingValue('player.respectReducedMotion')
  const quality = useSettingValue('player.particleQuality')
  const displayMode = useSettingValue('player.lyricDisplayMode')
  const lyricColor = useSettingValue('player.lyricColor')
  const switches = [
    { key: 'player.immersiveVisualsEnabled', check: enabled, label: t('setting_play_immersive_enabled'), disabled: false },
    { key: 'player.lyricMotionEnabled', check: lyricMotion, label: t('setting_play_immersive_lyric_motion'), disabled: !enabled },
    { key: 'player.lyricPulseEnabled', check: lyricPulse, label: t('setting_play_immersive_lyric_pulse'), disabled: !enabled },
    { key: 'player.backgroundMotion', check: backgroundMotion, label: t('setting_play_immersive_background_motion'), disabled: !enabled },
    { key: 'player.respectReducedMotion', check: respectReducedMotion, label: t('setting_play_immersive_reduced_motion'), disabled: !enabled },
  ] as const
  return <View style={styles.content}>
    <SubTitle title={t('setting_play_lyric_display')}>
      <View style={styles.qualities}>
        {(['single', 'multiple'] as const).map(mode => <Control key={mode} radio label={t(`setting_play_lyric_${mode}`)}
          checked={displayMode == mode} onChange={() => { updateSetting({ 'player.lyricDisplayMode': mode }) }}>
          <CheckBox label={t(`setting_play_lyric_${mode}`)} check={displayMode == mode} marginRight={16} need
            onChange={() => { updateSetting({ 'player.lyricDisplayMode': mode }) }} />
        </Control>)}
      </View>
    </SubTitle>
    <SubTitle title={t('setting_play_lyric_color')}>
      <View style={styles.qualities}>
        {lyricColors.map(({ color, label }) => <TouchableOpacity key={color} accessibilityRole="radio"
          accessibilityLabel={t(label)} accessibilityState={{ checked: lyricColor == color }}
          onPress={() => { updateSetting({ 'player.lyricColor': color }) }}
          style={[styles.colorButton, { borderColor: lyricColor == color ? color : 'transparent' }]}>
          <View style={[styles.swatch, { backgroundColor: color }]} />
        </TouchableOpacity>)}
      </View>
    </SubTitle>
    <InputItem label={t('setting_play_lyric_custom_color')} accessibilityLabel={t('setting_play_lyric_custom_color')}
      value={lyricColor} maxLength={7} placeholder="#A8F6FF" autoCorrect={false}
      onChanged={(input, reset) => {
        const color = normalizeLyricColor(input)
        if (color) updateSetting({ 'player.lyricColor': color })
        else toast(t('setting_play_lyric_color_invalid'))
        reset(color ?? lyricColor)
      }} />
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
  colorButton: { width: 44, height: 44, marginRight: 8, marginVertical: 4, borderWidth: 2, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 28, height: 28, borderRadius: 14 },
})
