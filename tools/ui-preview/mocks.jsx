import { useSyncExternalStore, useState } from 'react'
import { StyleSheet } from 'react-native'
import themes from '../../src/theme/themes/themes'
import { VINYL_COLORS } from '../../src/theme/design'
import zh from '../../src/lang/zh-cn.json'
import en from '../../src/lang/en-us.json'

// Preview adapters only: the Android app continues to use its real stores.
export const state = { nav: 'nav_search', theme: 'mineradio', lang: 'zh-cn', playing: false, detail: false, progress: 0.32 }
const listeners = new Set()
let revision = 0
export const update = values => { Object.assign(state, values); revision++; listeners.forEach(fn => fn()) }
const useRevision = () => useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn) }, () => revision)
export const tracks = [
  { id: 'demo-1', name: '晚风经过', singer: 'LX Sessions', interval: '03:42', source: 'kw', meta: { albumName: '夜航', picUrl: null, _qualitys: { flac: true } } },
  { id: 'demo-2', name: '城市漫游', singer: 'LX Sessions', interval: '04:08', source: 'kw', meta: { albumName: '城市漫游', picUrl: null, _qualitys: { '320k': true } } },
  { id: 'demo-3', name: '海岸线', singer: 'LX Sessions', interval: '03:56', source: 'kw', meta: { albumName: '海岸线', picUrl: null, _qualitys: { flac: true } } },
]
tracks.forEach((track, index) => { track.meta.picUrl = `http://127.0.0.1:4173/art/${['night', 'city', 'coast'][index]}.svg` })
let trackIndex = 0
export const useTheme = () => {
  useRevision()
  const theme = themes.find(t => t.id == state.theme)
  const c = theme.config.themeColors
  return {
    ...theme, ...c, ...theme.config.extInfo,
    'c-font': c['c-850'], 'c-font-label': c['c-450'], 'c-primary-font': c['c-primary'],
    'c-button-font': c['c-primary-alpha-100'], 'c-primary-background-hover': c['c-primary-light-300-alpha-800'],
    ...(theme.id == 'mineradio' ? VINYL_COLORS : {}),
  }
}
export const useTextShadow = () => false
export const useI18n = () => { useRevision(); return (key, values) => Object.entries(values ?? {}).reduce((message, [name, value]) => message.replace(`{${name}}`, value), (state.lang == 'en-us' ? en : zh)[key] ?? key) }
export const useNavActiveId = () => { useRevision(); return state.nav }
export const setNavActiveId = nav => update({ nav })
export const useStatusbarHeight = () => 20
export const useHorizontalMode = () => false
export const useAssertApiSupport = () => true
export const usePageVisible = () => {}
export const useSettingValue = key => ({ 'common.drawerLayoutPosition': 'left', 'common.autoHidePlayBar': true, 'common.allowProgressBarSeek': true }[key])
export const useKeyboard = () => ({ keyboardShown: false })
export const useWindowSize = () => ({ width: 375, height: 812 })
export const useLayout = () => {
  const [size, setSize] = useState({ width: 36, height: 36 })
  return { ...size, onLayout: ({ nativeEvent }) => { const { width, height } = nativeEvent.layout; setSize({ width, height }) } }
}
export const createStyle = StyleSheet.create
export const scaleSizeH = v => v
export const scaleSizeW = v => v
export const scaleSizeWR = v => v
export const setSpText = v => v
export const scaleSizeAbsHR = v => v
export const formatMusicName = (_, name, singer) => `${name} · ${singer}`
export const usePlayerMusicInfo = () => { useRevision(); return { ...tracks[trackIndex], pic: tracks[trackIndex].meta.picUrl } }
export const useIsPlay = () => { useRevision(); return state.playing }
export const State = { Playing: 'playing', Paused: 'paused' }
export const usePlaybackState = () => { useRevision(); return state.playing ? State.Playing : State.Paused }
export const usePlayMusicInfo = () => { useRevision(); return { musicInfo: tracks[trackIndex] } }
export const togglePlay = () => update({ playing: !state.playing })
export const playNext = () => { trackIndex = (trackIndex + 1) % tracks.length; update({}) }
export const playPrev = () => { trackIndex = (trackIndex + tracks.length - 1) % tracks.length; update({}) }
export const playList = (_, index) => { trackIndex = index; update({ playing: true }) }
export const getListMusics = async() => tracks
export const LIBRARY_EVENT = 'preview-library-updated'
const recentPreview = {
  music: { id: 'recent-1', name: 'My Happy Ending', singer: 'Avril Lavigne', interval: '03:59', source: 'kw', meta: { albumName: 'Under My Skin · Pop Rock', picUrl: 'http://127.0.0.1:4173/art/night.svg' } },
  playedAt: Date.now() - 3_600_000,
  playCount: 6,
  listenedSeconds: 1950,
  completedCount: 4,
}
export const getRecentTracks = async() => [recentPreview]
export const playLibraryMusic = music => { const index = tracks.findIndex(track => track.id == music.id); if (index >= 0) trackIndex = index; update({ playing: true }) }
export const buildListeningProfile = () => ({ artists: [{ id: 'avril lavigne', name: 'Avril Lavigne', weight: 4 }], languages: [{ id: 'en', weight: 4 }], styles: [{ id: 'rock', weight: 3, averageDuration: 239 }], averageDuration: 239 })
export const getTopLanguage = profile => profile.languages[0]?.id ?? ''
export const rankRecommendedPlaylists = lists => lists
const recommendationTracks = [
  { id: 'rec-1', name: 'Complicated', singer: 'Avril Lavigne', interval: '04:04', source: 'kw', meta: { albumName: 'Let Go · Pop Rock', picUrl: 'http://127.0.0.1:4173/art/city.svg' } },
  { id: 'rec-2', name: 'Wish You Were Here', singer: 'Avril Lavigne', interval: '03:45', source: 'kw', meta: { albumName: 'Goodbye Lullaby · Pop Rock', picUrl: 'http://127.0.0.1:4173/art/coast.svg' } },
  { id: 'rec-3', name: 'Losing Grip', singer: 'Avril Lavigne', interval: '03:53', source: 'kw', meta: { albumName: 'Let Go · Pop Rock', picUrl: 'http://127.0.0.1:4173/art/night.svg' } },
]
export const getRecommendedSongs = async() => recommendationTracks.map(music => ({ music, reasons: ['ui_recommend_reason_artist', 'ui_recommend_reason_style'] }))
export const rankRecommendedTracks = items => items.map(music => ({ music, reasons: ['ui_recommend_reason_artist', 'ui_recommend_reason_style'] }))
export const getSongListSetting = async() => ({ source: 'kw', tagId: '', sortId: 'new' })
export const getList = async() => ({ list: tracks.map(track => ({ id: track.id, name: track.meta.albumName, img: track.meta.picUrl, author: '界面预览数据', source: 'kw' })) })
export const useProgress = () => { useRevision(); return { progress: state.progress, maxPlayTime: 222, nowPlayTimeStr: '01:11', maxPlayTimeStr: '03:42' } }
export const useBufferProgress = () => 180
export const useStatusText = () => state.playing ? '正在播放' : '已暂停'
export const useLrcPlay = () => ({ text: '让音乐，陪你一整天' })
export const setLoadErrorPicUrl = () => {}
export const setMusicInfo = () => {}
export const useNavigationComponentDidAppear = (_, fn) => { /* Shared cover is immediately visible in preview. */ }
export const navigations = { pushPlayDetailScreen: () => update({ detail: true }), pushSonglistDetailScreen: () => update({ nav: 'nav_songlist' }) }
export default { componentIds: { home: 'preview', playDetail: 'preview' }, playMusicInfo: { listId: 'preview' } }
