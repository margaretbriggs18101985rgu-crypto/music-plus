import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ActivityIndicator, Animated, Easing, FlatList, Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { getArtistIdentity, getTrackArtists, type Artist } from '@/core/music/artist'
import { useTheme } from '@/store/theme/hook'
import { getDesignTokens } from '@/theme/design'
import { navigations, useNavigationComponentDidDisappear } from '@/navigation'
import { toast } from '@/utils/tools'

export interface ArtistPickerRef { open: () => void }
export default forwardRef<ArtistPickerRef, { componentId: string, music?: LX.Music.MusicInfo | null }>(({ componentId, music }, ref) => {
  const theme = useTheme()
  const colors = getDesignTokens(theme)
  const [visible, setVisible] = useState(false)
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const animation = useRef(new Animated.Value(0)).current
  const version = useRef(0)
  const opened = useRef(false)
  const closing = useRef(false)
  const mounted = useRef(true)
  const reset = useCallback(() => { version.current++; opened.current = false; closing.current = false; animation.stopAnimation(); animation.setValue(0); setVisible(false) }, [animation])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; animation.stopAnimation() }
  }, [animation])
  // Cancelling or changing songs invalidates the lookup, including single-artist auto navigation.
  useEffect(() => { reset() }, [music?.id, reset])
  useNavigationComponentDidDisappear(componentId, reset)
  const close = (after?: () => void) => {
    if (closing.current) return
    closing.current = true
    version.current++
    Animated.timing(animation, { toValue: 0, duration: 190, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (!finished || !mounted.current) return
      setVisible(false); opened.current = false; closing.current = false
      after?.()
    })
  }
  const navigate = (artist: Artist) => { close(() => { void navigations.pushArtistScreen(componentId, artist).catch(() => { toast('歌手页面打开失败，请重试') }) }) }
  const lookup = async() => {
    if (!music) return
    const request = ++version.current
    setLoading(true); setError(''); setArtists([])
    try {
      const result = await getTrackArtists(music)
      if (request != version.current || !mounted.current) return
      if (result.length == 1) navigate(result[0])
      else {
        setArtists(result)
        // Portraits load independently so the choice panel responds immediately.
        void Promise.allSettled(result.map(getArtistIdentity)).then(items => {
          if (request != version.current || !mounted.current) return
          setArtists(items.map((item, index) => item.status == 'fulfilled' ? item.value : result[index]))
        })
      }
    } catch (error) {
      if (request == version.current && mounted.current) setError(error instanceof Error ? error.message : '歌手资料获取失败，请重试')
    } finally { if (request == version.current && mounted.current) setLoading(false) }
  }
  useImperativeHandle(ref, () => ({
    open() {
      if (!music || opened.current) return
      opened.current = true; closing.current = false
      animation.setValue(0); setVisible(true)
      void lookup()
    },
  }))
  return <Modal visible={visible} transparent animationType="none" statusBarTranslucent hardwareAccelerated onRequestClose={() => { close() }}
    onShow={() => { if (opened.current && !closing.current) Animated.timing(animation, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start() }}>
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#00000099', opacity: animation }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="关闭歌手选择" style={StyleSheet.absoluteFillObject} onPress={() => { close() }} />
      <Animated.View accessibilityViewIsModal style={{ maxHeight: '70%', paddingBottom: 30, backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, opacity: animation, transform: [{ translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [240, 0] }) }] }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}><View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: colors.muted, opacity: 0.45 }} /></View>
        <View style={{ paddingLeft: 24, paddingRight: 12, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }}>
          <View style={{ flex: 1 }}><Text size={18} style={{ fontWeight: '600' }}>{artists.length > 1 ? '该歌曲有多个歌手' : '歌手资料'}</Text>
            <Text size={12} color={colors.muted} style={{ marginTop: 6 }}>{artists.length > 1 ? '选择歌手，查看 TA 的音乐与专辑' : '正在寻找这首歌的创作者'}</Text></View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="关闭歌手选择" onPress={() => { close() }} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={16} color={colors.muted} /></TouchableOpacity>
        </View>
        {loading ? <View style={{ alignItems: 'center', padding: 36 }}><ActivityIndicator color={colors.text} /><Text size={13} color={colors.muted} style={{ marginTop: 16 }}>正在获取歌手资料…</Text></View> : null}
        {error ? <View style={{ padding: 24 }}><Text size={13} color={colors.muted}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => { void lookup() }} style={{ minHeight: 48, justifyContent: 'center', marginTop: 8 }}><Text size={14}>点击重试</Text></TouchableOpacity></View> : null}
        <FlatList data={artists} keyExtractor={item => `${item.source}_${item.id}`} contentContainerStyle={{ paddingHorizontal: 24 }} renderItem={({ item }) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`查看 ${item.name} 的歌手主页`} onPress={() => { navigate(item) }} activeOpacity={0.65} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 94, paddingVertical: 14 }}>
          <Image url={item.avatar} style={{ width: 62, height: 62, borderRadius: 31, marginRight: 17 }} />
          <View style={{ flex: 1 }}><Text size={18} numberOfLines={2}>{item.name}</Text><Text size={11} color={colors.muted} style={{ marginTop: 7 }}>{item.source == 'wy' ? '网易云音乐' : 'QQ音乐'} · 歌手</Text></View>
          <Icon name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>} />
      </Animated.View>
    </View>
  </Modal>
})
