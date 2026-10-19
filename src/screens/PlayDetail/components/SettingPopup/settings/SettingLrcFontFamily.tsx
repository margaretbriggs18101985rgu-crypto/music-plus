import { StyleSheet, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { LYRIC_FONTS, normalizeLyricFont } from '@/utils/lyricAppearance'

export default () => {
  const selected = normalizeLyricFont(useSettingValue('player.lyricFontFamily'))
  return <View style={styles.container}>
    <Text>歌词字体</Text>
    <Text size={12} color="#99999F" style={styles.hint}>点击即生效，两种布局通用，离线可用</Text>
    <View style={styles.list}>
      {LYRIC_FONTS.map(font => <TouchableOpacity key={font.id} accessibilityRole="radio"
        accessibilityLabel={`歌词字体：${font.name}`} accessibilityState={{ selected: selected == font.id }}
        onPress={() => { updateSetting({ 'player.lyricFontFamily': font.id }) }}
        style={[styles.option, selected == font.id && styles.selected]}>
        <View style={styles.label}><Text size={14}>{font.name}</Text>
          <Text size={12} color={selected == font.id ? '#A8F6FF' : '#99999F'}>{selected == font.id ? '已选择' : font.detail}</Text></View>
        <Text appearance="fixed" size={23} style={{ fontFamily: font.family, marginTop: 7 }}>星光与音乐相遇 Aa</Text>
      </TouchableOpacity>)}
    </View>
  </View>
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 15, paddingTop: 5, paddingBottom: 20, alignSelf: 'stretch' },
  hint: { marginTop: 6, marginBottom: 12 },
  list: { gap: 9 },
  option: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#404047', backgroundColor: '#242429' },
  selected: { borderColor: '#A8F6FF', backgroundColor: '#283338' },
  label: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
})
