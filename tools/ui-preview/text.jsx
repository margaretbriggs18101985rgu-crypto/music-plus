import { Text } from 'react-native'
import { useTheme } from './mocks'
export default function PreviewText({ size = 15, color, style, ...props }) {
  const theme = useTheme()
  return <Text style={[{ fontSize: size, color: color ?? theme['c-font'], fontFamily: 'system-ui, sans-serif' }, style]} {...props} />
}
