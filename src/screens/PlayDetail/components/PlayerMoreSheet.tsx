import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ComponentProps } from 'react'
import { AccessibilityInfo, Animated, Easing, KeyboardAvoidingView, Modal, PanResponder, Pressable, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import SheetIcon from 'react-native-vector-icons/Feather'
import { useTheme } from '@/store/theme/hook'
import { ThemeContext } from '@/store/theme/state'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useTimeoutExitTimeInfo } from '@/core/player/timeoutExit'
import { formatPlayTime2 } from '@/utils/common'
import ImmersiveVisuals from '@/screens/Home/Views/Setting/settings/Player/ImmersiveVisuals'
import IsShowLyricTranslation from '@/screens/Home/Views/Setting/settings/Player/IsShowLyricTranslation'
import IsShowLyricRoma from '@/screens/Home/Views/Setting/settings/Player/IsShowLyricRoma'
import IsS2T from '@/screens/Home/Views/Setting/settings/Player/IsS2T'
import SettingVolume from './SettingPopup/settings/SettingVolume'
import SettingPlaybackRate from './SettingPopup/settings/SettingPlaybackRate'
import SettingSleepTimer from './SettingPopup/settings/SettingSleepTimer'
import SettingLrcFontSize from './SettingPopup/settings/SettingLrcFontSize'
import SettingLrcFontFamily from './SettingPopup/settings/SettingLrcFontFamily'
import SettingLrcAlign from './SettingPopup/settings/SettingLrcAlign'
import SettingQuality from './SettingPopup/settings/SettingQuality'

type Panel = 'main' | 'appearance' | 'typography' | 'sleep' | 'audio' | 'quality'
type IconName = ComponentProps<typeof SheetIcon>['name']
export interface PlayerMoreSheetRef { show: () => void }
interface Props { music: LX.Player.MusicInfo, hasTrack: boolean, favorite: boolean, onAction: (action: string) => void }
const titles: Record<Panel, string> = { main: '播放设置', appearance: '歌词与粒子特效', typography: '歌词排版与翻译', sleep: '睡眠定时', audio: '音量与倍速播放', quality: '切换音质' }

export default forwardRef<PlayerMoreSheetRef, Props>(({ music, hasTrack, favorite, onAction }, ref) => {
  const { height } = useWindowDimensions()
  const sheetHeight = height * 0.74
  const theme = useTheme()
  const sheetTheme = useMemo(() => ({
    ...theme,
    isDark: true,
    'c-font': '#F0F0F2',
    'c-font-label': '#99999F',
    'c-content-background': '#1C1C1E',
    'c-primary-input-background': '#2B2B30',
  }), [theme])
  const [visible, setVisible] = useState(false)
  const [panel, setPanel] = useState<Panel>('main')
  const [systemReducedMotion, setSystemReducedMotion] = useState(false)
  const respectMotion = useSettingValue('player.respectReducedMotion')
  const displayMode = useSettingValue('player.lyricDisplayMode')
  const lyricColor = useSettingValue('player.lyricColor')
  const volume = useSettingValue('player.volume')
  const playbackRate = useSettingValue('player.playbackRate')
  const quality = useSettingValue('player.playQuality')
  const time = useTimeoutExitTimeInfo()
  const translate = useRef(new Animated.Value(sheetHeight)).current
  const opacity = useRef(new Animated.Value(0)).current
  const closing = useRef(false)
  const mounted = useRef(true)
  const reducedMotion = respectMotion && systemReducedMotion
  useEffect(() => {
    let active = true
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setSystemReducedMotion(value) })
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReducedMotion)
    return () => { active = false; sub.remove() }
  }, [])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; translate.stopAnimation(); opacity.stopAnimation() }
  }, [opacity, translate])
  const close = useCallback((after?: () => void) => {
    if (closing.current) return
    closing.current = true
    Animated.parallel([
      Animated.timing(translate, { toValue: sheetHeight, duration: reducedMotion ? 0 : 230, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: reducedMotion ? 0 : 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished || !mounted.current) return
      setVisible(false); closing.current = false
      after?.()
    })
  }, [opacity, reducedMotion, sheetHeight, translate])
  const closeRef = useRef(close)
  closeRef.current = close
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, gesture) => { translate.setValue(Math.max(0, gesture.dy)) },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 70 || gesture.vy > 0.65) closeRef.current()
      else Animated.spring(translate, { toValue: 0, damping: 26, stiffness: 250, mass: 1, useNativeDriver: true }).start()
    },
    onPanResponderTerminate: () => { Animated.spring(translate, { toValue: 0, useNativeDriver: true }).start() },
  }), [translate])
  useImperativeHandle(ref, () => ({
    show() {
      if (visible || closing.current) return
      setPanel('main'); translate.setValue(sheetHeight); opacity.setValue(0); setVisible(true)
    },
  }))
  const open = () => {
    if (reducedMotion) { translate.setValue(0); opacity.setValue(1); return }
    Animated.parallel([
      Animated.spring(translate, { toValue: 0, damping: 28, stiffness: 240, mass: 1, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start()
  }
  const action = (name: string) => { close(() => { onAction(name) }) }
  const row = (icon: IconName, label: string, onPress: () => void, value?: string, disabled = false) =>
    <TouchableOpacity key={label} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={[styles.row, disabled && styles.disabled]}>
      <SheetIcon name={icon} size={21} color="#E0E0E4" /><Text size={15} style={styles.rowLabel}>{label}</Text>
      {value ? <Text size={12} color="#8E8E94" numberOfLines={1} style={styles.rowValue}>{value}</Text> : null}
      <SheetIcon name="chevron-right" size={11} color="#77777D" />
    </TouchableOpacity>
  const timerLabel = time.isPlayedStop ? '播完当前歌曲' : time.time >= 0 ? formatPlayTime2(time.time) : '未开启'
  return <ThemeContext.Provider value={sheetTheme}>
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent hardwareAccelerated onShow={open}
      onRequestClose={() => { if (panel != 'main') setPanel('main'); else close() }}>
      <KeyboardAvoidingView behavior="padding" style={styles.overlay}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000000', opacity: opacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.60] }) }]} />
        <Pressable accessibilityRole="button" accessibilityLabel="关闭播放菜单" style={StyleSheet.absoluteFillObject} onPress={() => { close() }} />
        <Animated.View accessibilityViewIsModal style={[styles.sheet, { height: sheetHeight, transform: [{ translateY: translate }] }]}>
          <View {...pan.panHandlers} accessible accessibilityRole="button" accessibilityLabel="下拉关闭播放菜单"
            accessibilityActions={[{ name: 'activate', label: '关闭播放菜单' }]}
            onAccessibilityAction={() => { close() }} style={styles.handleArea}><View style={styles.handle} /></View>
          {panel == 'main' ? <>
            <View {...pan.panHandlers} style={styles.songHeader}>
              <Image url={music.pic} style={styles.cover} />
              <View style={styles.songText}><Text size={17} numberOfLines={1} style={styles.songTitle}>{hasTrack ? music.name : '还没有播放的歌曲'}</Text>
                <Text size={14} numberOfLines={1} color="#909096" style={styles.artist}>{hasTrack ? music.singer || '未知歌手' : '选择歌曲后开始聆听'}</Text></View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={favorite ? '取消喜欢' : '喜欢当前歌曲'} disabled={!hasTrack}
                hitSlop={8}
                onPress={() => { onAction('favorite') }} style={[styles.like, !hasTrack && styles.disabled]}>
                <SheetIcon name="heart" size={17} color="#FF4C57" /><Text size={12} color={favorite ? '#FF4C57' : '#C4C4C9'}>{favorite ? '已喜欢' : '喜欢'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView key="main" contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <View style={styles.divider} />
              <View style={styles.quickActions}>{([
                ['folder-plus', '收藏到歌单', () => { action('addToPlaylist') }],
                ['download', '下载歌曲', () => { action('download') }],
                ['share-2', '分享歌曲', () => { action('share') }],
                ['clock', '睡眠定时', () => { setPanel('sleep') }],
              ] as const).map(([icon, label, onPress]) => <TouchableOpacity key={label} accessibilityRole="button" accessibilityLabel={label}
                disabled={!hasTrack && label != '睡眠定时'} onPress={onPress} style={[styles.quick, !hasTrack && label != '睡眠定时' && styles.disabled]}>
                <SheetIcon name={icon} size={26} color="#E7E7EB" /><Text size={12} style={styles.quickLabel}>{label}</Text>
              </TouchableOpacity>)}</View>
              {row('disc', `专辑：${music.album || '暂无专辑信息'}`, () => { action('album') }, undefined, !hasTrack)}
              {row('user', `歌手：${music.singer || '未知歌手'}`, () => { action('artist') }, undefined, !hasTrack)}
              {row('info', '查看歌曲百科', () => { action('info') }, undefined, !hasTrack)}
              <View style={styles.divider} />
              {row('list', '播放列表', () => { action('queue') })}
              {row('headphones', '切换音质', () => { setPanel('quality') }, quality)}
              {row('fast-forward', '音量与倍速播放', () => { setPanel('audio') }, `${Math.round(volume * 100)}% · ${playbackRate.toFixed(2)}x`)}
              <View style={styles.divider} />
              {row('align-center', '歌词显示', () => { updateSetting({ 'player.lyricDisplayMode': displayMode == 'single' ? 'multiple' : 'single' }) }, displayMode == 'single' ? '单句歌词' : '多排歌词')}
              {row('sliders', '歌词颜色与粒子特效', () => { setPanel('appearance') }, lyricColor)}
              {row('type', '歌词排版与翻译', () => { setPanel('typography') })}
              {row('clock', '睡眠定时', () => { setPanel('sleep') }, timerLabel)}
            </ScrollView>
          </> : <>
            <View style={styles.panelHeader}><TouchableOpacity accessibilityRole="button" accessibilityLabel="返回播放菜单" style={styles.back} onPress={() => { setPanel('main') }}>
              <SheetIcon name="chevron-left" size={20} color="#EEEEF2" /></TouchableOpacity><Text size={17} style={styles.panelTitle}>{titles[panel]}</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="关闭播放菜单" onPress={() => { close() }} style={styles.back}><SheetIcon name="x" size={15} color="#99999F" /></TouchableOpacity></View>
            <ScrollView key={panel} contentContainerStyle={styles.settingsBody} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
              {panel == 'appearance' ? <ImmersiveVisuals /> : null}
              {panel == 'typography' ? <><SettingLrcFontFamily /><SettingLrcFontSize direction="vertical" native /><SettingLrcAlign native /><IsShowLyricTranslation /><IsShowLyricRoma /><IsS2T /></> : null}
              {panel == 'audio' ? <><SettingVolume /><SettingPlaybackRate /></> : null}
              {panel == 'sleep' ? <SettingSleepTimer /> : null}
              {panel == 'quality' ? <SettingQuality /> : null}
            </ScrollView>
          </>}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  </ThemeContext.Provider>
})

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', paddingBottom: 20 },
  handleArea: { height: 22, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 34, height: 4, borderRadius: 2, backgroundColor: '#3E3E42' },
  songHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 4, paddingBottom: 15, gap: 13 },
  cover: { width: 56, height: 56, borderRadius: 7 },
  songText: { flex: 1 },
  songTitle: { fontWeight: '600' },
  artist: { marginTop: 6 },
  like: { minHeight: 32, borderRadius: 18, borderWidth: 1, borderColor: '#5E5E64', paddingHorizontal: 11, flexDirection: 'row', gap: 5, alignItems: 'center' },
  body: { paddingHorizontal: 23, paddingBottom: 24 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#303034', marginVertical: 7 },
  quickActions: { flexDirection: 'row', paddingVertical: 10 },
  quick: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 68 },
  quickLabel: { marginTop: 12 },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 17 },
  rowLabel: { flex: 1 },
  rowValue: { maxWidth: '38%' },
  disabled: { opacity: 0.35 },
  panelHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  panelTitle: { flex: 1, textAlign: 'center', fontWeight: '500' },
  settingsBody: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 36 },
})
