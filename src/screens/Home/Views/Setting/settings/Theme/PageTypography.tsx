import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import SubTitle from '../../components/SubTitle'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import ColorPickerButton from '@/components/common/ColorPickerButton'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { PAGE_FONTS, normalizePageFont, normalizePageColor } from '@/utils/pageAppearance'

const colors = ['#F3F3F5', '#1B1B20', '#A8F6FF', '#FFD38A', '#FFB6D5']
export default memo(() => {
  const theme = useTheme()
  const font = normalizePageFont(useSettingValue('theme.pageFontFamily'))
  const color = normalizePageColor(useSettingValue('theme.pageFontColor'))
  return <>
    <SubTitle title="页面字体">
      <Text size={12} color={theme['c-font-label']}>更改页面文字，不影响歌词；歌词字体在播放器中设置。</Text>
      <View accessibilityRole="radiogroup" style={{ gap: 8, marginTop: 10 }}>
        {PAGE_FONTS.map(item => <TouchableOpacity key={item.id} accessibilityRole="radio" accessibilityLabel={`页面字体：${item.name}`} accessibilityState={{ checked: font == item.id }}
          onPress={() => { updateSetting({ 'theme.pageFontFamily': item.id }) }} style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: font == item.id ? theme['c-font'] : theme['c-border-background'] }}>
          <Text size={14}>{item.name}{font == item.id ? ' · 已选择' : ''}</Text>
          <Text size={20} style={{ fontFamily: item.family, marginTop: 5 }}>音乐与生活 Music 123</Text>
        </TouchableOpacity>)}
      </View>
    </SubTitle>
    <SubTitle title="页面文字颜色">
      <Text size={12} color={theme['c-font-label']}>点击预设或打开色盘选择，歌词颜色保持独立。</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 }}>
        {colors.map(value => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityLabel={`页面文字颜色 ${value}`} accessibilityState={{ checked: color == value }}
          onPress={() => { updateSetting({ 'theme.pageFontColor': value }) }} style={{ width: 44, height: 44, borderRadius: 22, padding: 7, borderWidth: 2, borderColor: color == value ? theme['c-font'] : theme['c-border-background'] }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: value }} />
        </TouchableOpacity>)}
        <ColorPickerButton label="页面文字色盘" value={color || theme['c-font']} onChange={value => { updateSetting({ 'theme.pageFontColor': value }) }} />
      </View>
      <Text size={16}>页面文字预览 · Music 123</Text>
      <Button onPress={() => { updateSetting({ 'theme.pageFontColor': '' }) }} style={{ marginTop: 10, alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}><Text appearance="fixed" color={theme['c-font']} size={13}>恢复跟随主题颜色</Text></Button>
    </SubTitle>
  </>
})
