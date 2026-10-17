import { useEffect, useRef } from 'react'
import { Animated, LayoutAnimation, Platform, ScrollView, TouchableOpacity, UIManager, View, type ViewStyle } from 'react-native'
import Text from './Text'
import { useTheme } from '@/store/theme/hook'

if (Platform.OS == 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true)
export const animateLayoutChange = () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut) }
export const OFFICIAL_PLATFORMS = [{ value: 'tx', label: 'QQ音乐' }, { value: 'wy', label: '网易云音乐' }] as const
const Option = ({ label, active, onPress, size }: { label: string, active: boolean, onPress: () => void, size: number }) => {
  const theme = useTheme()
  const opacity = useRef(new Animated.Value(active ? 1 : 0)).current
  useEffect(() => { Animated.timing(opacity, { toValue: active ? 1 : 0, duration: 170, useNativeDriver: true }).start() }, [active, opacity])
  return <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} activeOpacity={0.65} style={{ minHeight: 48, paddingHorizontal: 9, justifyContent: 'center' }}>
    <Text size={size} color={active ? theme['c-font'] : theme['c-font-label']} numberOfLines={1}>{label}</Text>
    <Animated.View style={{ position: 'absolute', bottom: 3, left: 9, right: 9, height: 2, backgroundColor: theme['c-font'], opacity }} />
  </TouchableOpacity>
}
export default <T extends string>({ value, options, onChange, style, size = 13 }: { value: T, options: ReadonlyArray<{ value: T, label: string }>, onChange: (value: T) => void, style?: ViewStyle, size?: number }) => (
  <View style={[{ flexShrink: 1 }, style]}><ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ alignItems: 'center' }}>
    {options.map(item => <Option key={item.value} label={item.label} active={value == item.value} size={size} onPress={() => { if (value != item.value) onChange(item.value) }} />)}
  </ScrollView></View>
)
