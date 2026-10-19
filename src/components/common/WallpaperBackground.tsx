import { Image, requireNativeComponent, StyleSheet, View, type ViewProps } from 'react-native'

type WallpaperKind = 'image' | 'gif' | 'video'

interface NativeWallpaperProps extends ViewProps {
  path: string
  kind: WallpaperKind
}

const NativeWallpaperView = requireNativeComponent<NativeWallpaperProps>('LXWallpaperView')

export default ({ path, kind, style }: NativeWallpaperProps) => {
  if (kind == 'video') return <NativeWallpaperView path={path} kind={kind} style={style} />
  const uri = path.startsWith('/') ? `file://${path}` : path
  return (
    <View style={style} pointerEvents="none">
      <Image source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
    </View>
  )
}
