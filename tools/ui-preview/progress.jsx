import { View } from 'react-native'
import { useTheme } from './mocks'
export default function Progress({ progress = 71, duration = 222 }) {
  const theme = useTheme()
  return <View style={{ justifyContent: 'center', minHeight: 3, flex: 1 }}><View style={{ height: 3, borderRadius: 2, backgroundColor: theme['c-border-background'] ?? '#293440', overflow: 'hidden' }}><View style={{ height: 3, width: `${(progress <= 1 ? progress : progress / duration) * 100}%`, backgroundColor: theme['c-primary'] }} /></View></View>
}
export const ProgressPlain = Progress
