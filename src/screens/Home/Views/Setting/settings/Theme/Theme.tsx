import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { setTheme } from '@/core/theme'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import SubTitle from '../../components/SubTitle'
import Text from '@/components/common/Text'

const options = [
  { id: 'mineradio', name: '黑胶深色', background: '#0D0D12', foreground: '#F3F3F5' },
  { id: 'white', name: '白色', background: '#FAFAFC', foreground: '#1B1B20' },
] as const
export default memo(() => {
  const active = useSettingValue('theme.id')
  const theme = useTheme()
  return <SubTitle title="页面主题">
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
      {options.map(item => <TouchableOpacity key={item.id} accessibilityRole="radio" accessibilityLabel={`页面主题：${item.name}`} accessibilityState={{ checked: active == item.id }}
        onPress={() => { setTheme(item.id) }} style={{ flex: 1, maxWidth: 190, padding: 12, borderRadius: 10, minHeight: 90, borderWidth: 2, borderColor: active == item.id ? theme['c-font'] : theme['c-border-background'], backgroundColor: item.background }}>
        <Text appearance="fixed" size={18} color={item.foreground}>Aa 音乐</Text>
        <Text appearance="fixed" size={13} color={item.foreground} style={{ marginTop: 10 }}>{item.name}{active == item.id ? ' ✓' : ''}</Text>
      </TouchableOpacity>)}
    </View>
  </SubTitle>
})
