import { memo, type ComponentProps } from 'react'
import { Text, type TextProps as _TextProps, StyleSheet, Animated, type ColorValue, type TextStyle } from 'react-native'
import { useTextShadow, useTheme } from '@/store/theme/hook'
import { setSpText } from '@/utils/pixelRatio'
import { useAnimateColor } from '@/utils/hooks/useAnimateColor'
import { DEFAULT_DURATION, useAnimateNumber } from '@/utils/hooks/useAnimateNumber'
import { usePageTypography } from '@/store/Provider/PageTypography'
import { resolvePageTextColor } from '@/utils/pageAppearance'
// import { AppColors } from '@/theme'

export interface TextProps extends _TextProps {
  appearance?: 'page' | 'fixed'
  /**
   * 字体大小
   */
  size?: number
  /**
   * 字体颜色
   */
  color?: ColorValue
}

// const warpText = <P extends TextProps>(Component: ComponentType<TextProps>) => {
//   return ({ style, size = 15, color, children, ...props }: P) => {
//     const theme = useTheme()
//     return (
//       <Component
//         style={StyleSheet.compose({ fontFamily: 'System', fontSize: setSpText(size), color: color ?? theme['c-font'] }, style)}
//         {...props}
//       >{children}</Component>
//     )
//   }
// }

export default memo(({ style, size = 15, color, appearance = 'page', children, ...props }: TextProps) => {
  const theme = useTheme()
  const typography = usePageTypography()
  const resolvedColor = appearance == 'fixed' ? StyleSheet.flatten(style)?.color ?? color ?? theme['c-font'] : resolvePageTextColor(StyleSheet.flatten(style)?.color ?? color ?? theme['c-font'], typography.color, theme)
  const textShadow = useTextShadow()
  style = StyleSheet.compose(textShadow ? {
    fontFamily: appearance == 'page' ? typography.fontFamily : undefined,
    textShadowColor: theme['c-primary-dark-300-alpha-800'],
    textShadowOffset: { width: 0.2, height: 0.2 },
    textShadowRadius: 2,
    fontSize: setSpText(size),
    color: color ?? theme['c-font'],
  } : {
    fontFamily: appearance == 'page' ? typography.fontFamily : undefined,
    fontSize: setSpText(size),
    color: color ?? theme['c-font'],
  }, style)

  return (
    <Text
      style={[style, { color: resolvedColor }]}
      {...props}
    >{children}</Text>
  )
})

export interface AnimatedTextProps extends _AnimatedTextProps {
  appearance?: 'page' | 'fixed'
  /**
   * 字体大小
   */
  size?: number
  /**
   * 字体颜色
   */
  color?: ColorValue
}
export const AnimatedText = ({ style, size = 15, color, appearance = 'page', children, ...props }: AnimatedTextProps) => {
  const theme = useTheme()
  const typography = usePageTypography()
  const resolvedColor = appearance == 'fixed' ? color ?? theme['c-font'] : resolvePageTextColor(color ?? theme['c-font'], typography.color, theme)
  const textShadow = useTextShadow()
  style = StyleSheet.compose(textShadow ? {
    fontFamily: appearance == 'page' ? typography.fontFamily : undefined,
    textShadowColor: theme['c-primary-dark-300-alpha-800'],
    textShadowOffset: { width: 0.2, height: 0.2 },
    textShadowRadius: 2,
    fontSize: setSpText(size),
    color: resolvedColor,
  } : {
    fontFamily: appearance == 'page' ? typography.fontFamily : undefined,
    fontSize: setSpText(size),
    color: resolvedColor,
  }, style as TextStyle)

  return <Animated.Text style={style} {...props}>{children}</Animated.Text>
}


type _AnimatedTextProps = ComponentProps<(typeof Animated)['Text']>
export interface AnimatedColorTextProps extends _AnimatedTextProps {
  appearance?: 'page' | 'fixed'
  /**
   * 字体大小
   */
  size?: number
  /**
   * 字体颜色
   */
  color?: string
  /**
   * 字体透明度
   */
  opacity?: number
}
export const AnimatedColorText = ({ style, size = 15, opacity: _opacity, color: _color, appearance = 'page', children, ...props }: AnimatedColorTextProps) => {
  const theme = useTheme()
  const typography = usePageTypography()
  const textShadow = useTextShadow()

  const targetColor = appearance == 'fixed' ? _color ?? theme['c-font'] : String(resolvePageTextColor(_color ?? theme['c-font'], typography.color, theme))
  const [color] = useAnimateColor(targetColor)
  const [opacity] = useAnimateNumber(_opacity ?? 1, DEFAULT_DURATION, false)

  style = StyleSheet.compose(textShadow ? {
    fontFamily: appearance == 'page' ? typography.fontFamily : undefined,
    textShadowColor: theme['c-primary-dark-300-alpha-800'],
    textShadowOffset: { width: 0.2, height: 0.2 },
    textShadowRadius: 2,
    fontSize: setSpText(size),
    color: color as unknown as ColorValue,
    opacity,
  } : {
    fontFamily: appearance == 'page' ? typography.fontFamily : undefined,
    fontSize: setSpText(size),
    color: color as unknown as ColorValue,
    opacity,
  }, style as TextStyle)

  return <Animated.Text style={style} {...props}>{children}</Animated.Text>
}
