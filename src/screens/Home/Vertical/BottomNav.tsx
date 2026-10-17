import { View, TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import { useNavActiveId } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { setNavActiveId } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { getDesignTokens } from '@/theme/design'

const items = [
  { id: 'nav_search', label: 'nav_search' },
  { id: 'nav_songlist', label: 'nav_songlist' },
  { id: 'nav_top', label: 'ui_nav_charts' },
  { id: 'nav_love', label: 'ui_nav_library' },
  { id: 'nav_setting', label: 'nav_setting' },
] as const

export default () => {
  const activeId = useNavActiveId()
  const colors = getDesignTokens(useTheme())
  const t = useI18n()
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} accessibilityRole="tablist">
      {items.map(({ id, label }) => {
        const active = id == activeId
        return (
          <TouchableOpacity key={id} style={styles.tab} onPress={() => { global.app_event.changeMenuVisible(false); setNavActiveId(id) }} accessibilityRole="tab" accessibilityLabel={t(id)} accessibilityState={{ selected: active }}>
            <Text size={16} numberOfLines={1} color={active ? colors.text : colors.muted} style={active ? styles.activeLabel : undefined}>{t(label)}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = createStyle({
  container: { flexDirection: 'row', paddingTop: 4, paddingBottom: 10 },
  tab: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  activeLabel: { fontWeight: '600' },
})
