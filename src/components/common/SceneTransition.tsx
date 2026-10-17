import { useLayoutEffect, useRef } from 'react'
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native'

interface Props {
  sceneKey: string
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  direction?: 'horizontal' | 'horizontal-reverse' | 'vertical' | 'fade'
}

export default ({ sceneKey, children, style, direction = 'vertical' }: Props) => {
  const opacity = useRef(new Animated.Value(1)).current
  const offset = useRef(new Animated.Value(0)).current
  const previousKey = useRef(sceneKey)

  useLayoutEffect(() => {
    if (previousKey.current == sceneKey) return
    previousKey.current = sceneKey

    const distance = direction == 'fade' ? 0 : direction == 'horizontal-reverse' ? -12 : 12
    opacity.setValue(0.35)
    offset.setValue(distance)
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(offset, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()
  }, [direction, offset, opacity, sceneKey])

  const transform = direction == 'horizontal' || direction == 'horizontal-reverse'
    ? [{ translateX: offset }]
    : direction == 'vertical'
      ? [{ translateY: offset }]
      : []

  return (
    <Animated.View style={[{ flex: 1, opacity, transform }, style]}>
      {children}
    </Animated.View>
  )
}
