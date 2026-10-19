import { useRef, useState } from 'react'
import { Modal, View, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native'
import WheelColorPicker from 'react-native-wheel-color-picker'
import Text from './Text'
import { useTheme } from '@/store/theme/hook'
import { getDesignTokens } from '@/theme/design'
import { normalizePageColor } from '@/utils/pageAppearance'

export default ({ value, label, onChange }: { value: string, label: string, onChange: (color: string) => void }) => {
  const theme = useTheme()
  const colors = getDesignTokens(theme)
  const { width, height } = useWindowDimensions()
  const [visible, setVisible] = useState(false)
  const [draft, setDraft] = useState('#FFFFFF')
  const [initialColor, setInitialColor] = useState('#FFFFFF')
  const draftRef = useRef(draft)
  const change = (color: string) => {
    const next = normalizePageColor(color)
    if (!next) return
    draftRef.current = next
    setDraft(next)
  }
  const close = () => { setVisible(false) }
  return <>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`打开${label}`} onPress={() => { const initial = normalizePageColor(value) || '#FFFFFF'; setInitialColor(initial); change(initial); setVisible(true) }}
      style={{ minWidth: 52, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: theme['c-font-label'], justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {['#FF5978', '#FFD35C', '#60D9AA', '#6CA2FF'].map(color => <View key={color} style={{ width: 6, height: 14, borderRadius: 3, backgroundColor: color }} />)}
      </View><Text size={10}>色盘</Text>
    </TouchableOpacity>
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <ScrollView style={{ flexGrow: 0, maxHeight: height - 90, width: Math.min(width - 40, 390), borderRadius: 18, backgroundColor: colors.surface }} contentContainerStyle={{ padding: 20 }}>
          <Text size={19} style={{ fontWeight: '600' }}>{label}</Text>
          <Text size={12} color={colors.muted} style={{ marginTop: 6 }}>拖动色盘选择颜色，下方调节明暗。</Text>
          {visible ? <View style={{ height: Math.min(width - 60, 320), marginVertical: 12 }}>
            <WheelColorPicker key={label} color={initialColor} swatches={false} thumbSize={26} sliderSize={26} noSnap
              onColorChange={change} onColorChangeComplete={change} useNativeDriver />
          </View> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }}>
            <View accessibilityLabel="已选颜色预览" style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: draft, borderWidth: 1, borderColor: colors.border }} />
            <Text appearance="fixed" color={draft} size={20}>音乐 Music</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 18 }}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`取消${label}`} onPress={close} style={{ minHeight: 48, paddingHorizontal: 10, justifyContent: 'center' }}><Text>取消</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`应用${label}`} onPress={() => { onChange(draftRef.current); close() }} style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' }}><Text>应用</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  </>
}
