import { View } from 'react-native'
import Text from './text'
import { useTheme } from './mocks'
import { getDesignTokens } from '../../src/theme/design'
export default () => {
  const colors = getDesignTokens(useTheme())
  return <View style={{ borderRadius: 12, padding: 10, backgroundColor: colors.elevated }}><Text size={11} color={colors.text}>歌曲 ▾</Text></View>
}
