import { Text } from 'react-native'
import config from '../../src/resources/fonts/selection.json'
export function Icon({ name, size = 15, rawSize, color, style }) {
  const glyph = config.icons.find(icon => icon.properties.name == name)?.properties.code
  return <Text aria-hidden style={[{ fontFamily: 'icomoon', fontSize: rawSize ?? size, color }, style]}>{glyph ? String.fromCodePoint(glyph) : ''}</Text>
}
