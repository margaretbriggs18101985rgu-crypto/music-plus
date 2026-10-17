import { View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import { getDesignTokens } from '@/theme/design'

export default () => {
  const colors = getDesignTokens(useTheme())
  const id = useNavActiveId()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  return (
    <View style={[styles.container, { paddingTop: statusBarHeight + 10 }]}>
      <StatusBar />
      <View style={styles.row}>
        <View style={styles.title}>
          <Text size={21} style={styles.heading} color={colors.text}>{t(id)}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = createStyle({
  container: { paddingHorizontal: 18, paddingBottom: 14, zIndex: 10 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1 },
  heading: { fontWeight: '600' },
})
