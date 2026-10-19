import { memo, useEffect, useMemo, useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import Slider from '@react-native-community/slider'
import Text from '@/components/common/Text'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { parseReactiveVisuals, reactiveVisualDefaults, reactiveVisualRanges, type ReactiveVisuals, type VisualNumberKey, type VisualSwitchKey } from '@/utils/reactiveVisuals'
import CheckBoxItem from '../../components/CheckBoxItem'

const labels: Record<keyof ReactiveVisuals, string> = {
  intensity: '律动强度',
  depth: '画面景深',
  coverResolution: '封面清晰度',
  cinema: '电影镜头强度',
  cinemaEnabled: '电影镜头',
  particleGlow: '粒子溢光',
  outlineHighlight: '歌词轮廓高亮',
  starRiver: '背景星河',
  particleSize: '粒子尺寸',
  speed: '运动速度',
  twist: '粒子扭曲',
  colorTension: '色彩张力',
  bloom: '光晕强度',
  scatter: '离散感',
  backgroundDim: '背景压暗',
  terrainEnabled: '显示音域地形',
  terrainHeight: '地形振幅',
  terrainDepth: '地形纵深',
  terrainOffset: '地形垂直位置',
  spectrumEnabled: '实时频谱',
  kickAuto: 'Kick 自动频段',
  kickSensitivity: 'Kick 灵敏度',
  kickLowHz: 'Kick 频段下限',
  kickHighHz: 'Kick 频段上限',
  bassWeight: '低频权重',
  midWeight: '中频权重',
  trebleWeight: '高频权重',
}

const RangeControl = memo(({ field, value, disabled, onChange }: {
  field: VisualNumberKey
  value: number
  disabled: boolean
  onChange: (value: number) => void
}) => {
  const theme = useTheme()
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])
  const [min, max, step] = reactiveVisualRanges[field]
  const display = field == 'coverResolution' ? `${Math.round(draft)}×${Math.round(draft)}`
    : field == 'kickLowHz' || field == 'kickHighHz' ? `${Math.round(draft)} Hz` : draft.toFixed(2)
  return <View style={[styles.range, disabled && styles.disabled]}>
    <View style={styles.rangeTitle}>
      <Text size={14}>{labels[field]}</Text>
      <Text size={12}>{display}</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`重置${labels[field]}`} disabled={disabled}
        style={styles.reset} onPress={() => { onChange(reactiveVisualDefaults[field]) }}><Text size={21}>↺</Text></TouchableOpacity>
    </View>
    <Slider style={styles.slider} accessibilityLabel={labels[field]} disabled={disabled} value={draft}
      minimumValue={min} maximumValue={max} step={step}
      minimumTrackTintColor={theme['c-button-background-active']} maximumTrackTintColor={theme['c-button-background']}
      thumbTintColor={theme['c-primary-light-100']} onValueChange={setDraft}
      onSlidingComplete={next => { onChange(Number(next.toFixed(3))) }} />
  </View>
})

const Section = ({ title, detail, children, initial = false }: { title: string, detail: string, children: React.ReactNode, initial?: boolean }) => {
  const [open, setOpen] = useState(initial)
  return <View style={styles.section}>
    <TouchableOpacity style={styles.heading} accessibilityRole="button" accessibilityLabel={title}
      accessibilityState={{ expanded: open }} onPress={() => { setOpen(!open) }}>
      <View style={styles.headingText}><Text>{title}</Text><Text size={12} style={styles.detail}>{detail}</Text></View>
      <Text>{open ? '▾' : '▸'}</Text>
    </TouchableOpacity>
    {open ? <View style={styles.sectionBody}>{children}</View> : null}
  </View>
}

export default memo(({ enabled }: { enabled: boolean }) => {
  const stored = useSettingValue('player.reactiveVisuals')
  const values = useMemo(() => parseReactiveVisuals(stored), [stored])
  const change = (field: keyof ReactiveVisuals, value: number | boolean) => {
    updateSetting({ 'player.reactiveVisuals': JSON.stringify({ ...values, [field]: value }) })
  }
  const range = (field: VisualNumberKey, disabled = false) => <RangeControl key={field} field={field}
    value={values[field]} disabled={!enabled || disabled} onChange={value => { change(field, value) }} />
  const toggle = (field: VisualSwitchKey) => <TouchableOpacity key={field} accessibilityRole="switch"
    accessibilityLabel={labels[field]} accessibilityState={{ checked: values[field], disabled: !enabled }}
    disabled={!enabled} style={styles.toggle} onPress={() => { change(field, !values[field]) }}>
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <CheckBoxItem label={labels[field]} check={values[field]} disabled={!enabled} onChange={() => {}} />
    </View>
  </TouchableOpacity>
  return <View style={styles.content}>
    <Text size={12} style={styles.detail}>律动来自正在播放的音频。低频鼓点推动镜头，中高频影响光影；暂停、缓冲和无音频时停止响应。</Text>
    <Section title="基础画面" detail="整体律动、空间景深、封面和电影镜头" initial>
      {range('intensity')}{range('depth')}{range('coverResolution')}{toggle('cinemaEnabled')}{range('cinema', !values.cinemaEnabled)}
    </Section>
    <Section title="粒子与光影" detail="尺寸、流速、扭曲、色彩和光晕">
      {toggle('particleGlow')}{toggle('outlineHighlight')}{toggle('starRiver')}
      {(['particleSize', 'speed', 'twist', 'colorTension', 'bloom', 'scatter', 'backgroundDim'] as const).map(field => range(field))}
    </Section>
    <Section title="音域地形" detail="由实际频谱形成的空间网格">
      {toggle('terrainEnabled')}{range('terrainHeight', !values.terrainEnabled)}{range('terrainDepth', !values.terrainEnabled)}{range('terrainOffset', !values.terrainEnabled)}
    </Section>
    <Section title="频谱响应" detail="32 段实时频谱、Kick 检测及频段权重">
      {toggle('spectrumEnabled')}{toggle('kickAuto')}
      <Text size={12} style={styles.detail}>自动模式按低频瞬态选择鼓点频段；关闭后使用下面的 Hz 范围。灵敏度越高越容易触发，也可能把贝斯或低音人声识别为鼓点。</Text>
      {range('kickSensitivity')}{range('kickLowHz', values.kickAuto)}{range('kickHighHz', values.kickAuto)}
      {range('bassWeight')}{range('midWeight')}{range('trebleWeight')}
    </Section>
    <TouchableOpacity accessibilityRole="button" style={styles.resetAll} disabled={!enabled}
      onPress={() => { updateSetting({ 'player.reactiveVisuals': JSON.stringify(reactiveVisualDefaults) }) }}>
      <Text size={14}>恢复上述视觉参数</Text>
    </TouchableOpacity>
  </View>
})

const styles = StyleSheet.create({
  content: { marginTop: 12, marginRight: 14 },
  section: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#88888855', borderRadius: 12, marginTop: 12 },
  heading: { minHeight: 64, flexDirection: 'row', alignItems: 'center', padding: 14 },
  headingText: { flex: 1 },
  detail: { opacity: 0.65, lineHeight: 20, marginTop: 4 },
  sectionBody: { paddingHorizontal: 14, paddingBottom: 12 },
  range: { marginBottom: 4 },
  rangeTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reset: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  slider: { width: '100%', height: 44, marginTop: -8 },
  disabled: { opacity: 0.35 },
  resetAll: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  toggle: { minHeight: 48, justifyContent: 'center', marginBottom: 8 },
})
