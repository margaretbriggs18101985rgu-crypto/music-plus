import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { requireNativeComponent, useWindowDimensions, type NativeSyntheticEvent, type ViewProps } from 'react-native'
import { Navigation } from 'react-native-navigation'
import { State } from 'react-native-track-player'
import { usePlaybackState } from '@/plugins/player/hook'
import { usePlayerMusicInfo, usePlayMusicInfo, useProgress, useStatusText } from '@/store/player/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { collectMusic, uncollectMusic, togglePlay, playNext, playPrev } from '@/core/player/player'
import { getListMusics } from '@/core/list'
import { updateSetting, setNavActiveId } from '@/core/common'
import { LIST_IDS, MUSIC_TOGGLE_MODE_LIST } from '@/config/constant'
import { pop, navigations } from '@/navigation'
import settingState from '@/store/setting/state'
import { shareMusic, toast } from '@/utils/tools'
import { defaultHeaders } from '@/components/common/Image'
import { showPlaybackQueue } from '@/components/player/PlaybackQueue'
import { showPlayerTool } from '@/components/player/PlayerTools'
import { useSettingValue } from '@/store/setting/hook'
import { useLrcSet, useLrcPlay } from '@/plugins/lyric'
import ArtistPicker, { type ArtistPickerRef } from '../components/ArtistPicker'
import PlayerMoreSheet, { type PlayerMoreSheetRef } from '../components/PlayerMoreSheet'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import { getTrackAlbum } from '@/core/music/artist'
import { normalizeLyricFont } from '@/utils/lyricAppearance'
import { normalizePageColor, normalizePageFont } from '@/utils/pageAppearance'
import { parseReactiveVisuals, type ReactiveVisuals } from '@/utils/reactiveVisuals'

interface PlayerActionEvent {
  action: string
  value: number
}
interface NativePlayerProps extends ViewProps {
  playerState: {
    trackId: string
    title: string
    artist: string
    artwork: string | null
    artworkUserAgent: string
    isPlaying: boolean
    hasTrack: boolean
    isStopped: boolean
    position: number
    duration: number
    favorite: boolean
    status: string
    topInset: number
    lyricsVisible: boolean
    lyrics: Array<{ time: number, text: string, translation: string }>
    activeLyric: number
    seekRevision: number
    immersiveVisualsEnabled: boolean
    reactiveVisuals: ReactiveVisuals
    particleQuality: LX.AppSetting['player.particleQuality']
    lyricMotionEnabled: boolean
    lyricPulseEnabled: boolean
    lyricDisplayMode: LX.AppSetting['player.lyricDisplayMode']
    lyricColor: string
    lyricFontSize: number
    lyricFontFamily: LX.AppSetting['player.lyricFontFamily']
    pageFontFamily: LX.AppSetting['theme.pageFontFamily']
    pageFontColor: string
    lyricAlign: LX.AppSetting['player.lyricAlign']
    backgroundMotion: boolean
    respectReducedMotion: boolean
    wallpaperPath: string
    wallpaperKind: LX.AppSetting['theme.wallpaper.kind']
    wallpaperScope: LX.AppSetting['theme.wallpaper.scope']
    playMode: string
    bottomInset: number
  }
  onPlayerAction: (event: NativeSyntheticEvent<PlayerActionEvent>) => void
}
const NativeVinylPlayer = requireNativeComponent<NativePlayerProps>('LXVinylPlayer')

export default ({ componentId }: { componentId: string }) => {
  const lines = useLrcSet()
  const lyric = useLrcPlay()
  const playMode = useSettingValue('player.togglePlayMethod')
  const immersiveVisualsEnabled = useSettingValue('player.immersiveVisualsEnabled')
  const storedReactiveVisuals = useSettingValue('player.reactiveVisuals')
  const reactiveVisuals = useMemo(() => parseReactiveVisuals(storedReactiveVisuals), [storedReactiveVisuals])
  const particleQuality = useSettingValue('player.particleQuality')
  const lyricMotionEnabled = useSettingValue('player.lyricMotionEnabled')
  const lyricPulseEnabled = useSettingValue('player.lyricPulseEnabled')
  const lyricDisplayMode = useSettingValue('player.lyricDisplayMode')
  const lyricColor = useSettingValue('player.lyricColor')
  const lyricFontSize = useSettingValue('player.lyricFontSize')
  const lyricFontFamily = normalizeLyricFont(useSettingValue('player.lyricFontFamily'))
  const pageFontFamily = normalizePageFont(useSettingValue('theme.pageFontFamily'))
  const pageFontColor = normalizePageColor(useSettingValue('theme.pageFontColor'))
  const lyricAlign = useSettingValue('player.lyricAlign')
  const backgroundMotion = useSettingValue('player.backgroundMotion')
  const respectReducedMotion = useSettingValue('player.respectReducedMotion')
  const wallpaperPath = useSettingValue('theme.wallpaper.path')
  const wallpaperKind = useSettingValue('theme.wallpaper.kind')
  const wallpaperScope = useSettingValue('theme.wallpaper.scope')
  const [lyricsVisible, setLyricsVisible] = useState(false)
  const { width, height } = useWindowDimensions()
  const landscape = width > height
  const [seekRevision, setSeekRevision] = useState(0)
  const music = usePlayerMusicInfo()
  const current = usePlayMusicInfo()
  const artistPicker = useRef<ArtistPickerRef>(null)
  const lyricSettings = useRef<PlayerMoreSheetRef>(null)
  const musicAdd = useRef<MusicAddModalType>(null)
  const albumRequest = useRef(0)
  useEffect(() => {
    const counter = albumRequest
    counter.current++
    return () => { counter.current++ }
  }, [music.id])
  const song = current.musicInfo && ('progress' in current.musicInfo ? current.musicInfo.metadata.musicInfo : current.musicInfo)
  const progress = useProgress()
  const playback = usePlaybackState()
  const statusText = useStatusText()
  const topInset = useStatusbarHeight()
  const [favorite, setFavorite] = useState(false)
  const hasTrack = !!current.musicInfo
  const favoriteId = current.musicInfo && ('progress' in current.musicInfo ? current.musicInfo.metadata.musicInfo.id : current.musicInfo.id)

  useEffect(() => {
    Navigation.mergeOptions(componentId, {
      layout: { orientation: ['portrait', 'landscape'] },
      statusBar: { style: 'light', backgroundColor: 'transparent' },
      navigationBar: { visible: !landscape, backgroundColor: '#000000' },
    })
  }, [componentId, landscape])

  useEffect(() => {
    // The original event also handles MediaSession/notification seeks, not just this screen.
    const onSeek = (position: number) => {
      if (Number.isFinite(position)) setSeekRevision(revision => revision + 1)
    }
    global.app_event.on('seekCompleted', onSeek)
    return () => { global.app_event.off('seekCompleted', onSeek) }
  }, [])

  useEffect(() => {
    let active = true
    const update = () => {
      void getListMusics(LIST_IDS.LOVE).then(list => {
        if (active) setFavorite(!!favoriteId && list.some(item => item.id == favoriteId))
      })
    }
    const onListUpdate = (ids: string[]) => { if (ids.includes(LIST_IDS.LOVE)) update() }
    update()
    global.app_event.on('myListMusicUpdate', onListUpdate)
    return () => { active = false; global.app_event.off('myListMusicUpdate', onListUpdate) }
  }, [favoriteId])

  const goHome = useCallback((id?: 'nav_search' | 'nav_songlist' | 'nav_love' | 'nav_setting') => {
    if (id) setNavActiveId(id)
    void pop(componentId)
  }, [componentId])

  const handlePlayerAction = (action: string, value: number) => {
    switch (action) {
      case 'back': goHome(); break
      case 'lyrics': setLyricsVisible(value == 1); break
      case 'mode':
        {
          const index = (MUSIC_TOGGLE_MODE_LIST.indexOf(settingState.setting['player.togglePlayMethod']) + 1) % MUSIC_TOGGLE_MODE_LIST.length
          updateSetting({ 'player.togglePlayMethod': MUSIC_TOGGLE_MODE_LIST[index] })
          toast(['列表循环', '随机播放', '顺序播放', '单曲循环', '播完停止'][index])
        }
        break
      case 'comment': if (hasTrack) navigations.pushCommentScreen(componentId); break
      case 'artist': if (hasTrack) artistPicker.current?.open(); break
      case 'queue': showPlaybackQueue(); break
      case 'settings': lyricSettings.current?.show(); break
      case 'addToPlaylist': if (song) musicAdd.current?.show({ musicInfo: song, listId: current.listId ?? '', isMove: false }); break
      case 'share': if (song) shareMusic('system', settingState.setting['download.fileName'], song); break
      case 'album':
        if (song) {
          const request = ++albumRequest.current
          toast('正在读取专辑资料')
          void getTrackAlbum(song).then(async album => {
            if (request == albumRequest.current) return navigations.pushAlbumScreen(componentId, album)
          }).catch((error: unknown) => { if (request == albumRequest.current) toast(error instanceof Error ? error.message : '专辑打开失败') })
        }
        break
      case 'info': if (hasTrack) showPlayerTool('info'); break
      case 'download': if (hasTrack) showPlayerTool('download'); break
      case 'toggle': if (hasTrack) togglePlay(); break
      case 'previous': if (hasTrack) void playPrev(); break
      case 'next': if (hasTrack) void playNext(); break
      case 'seek':
        if (hasTrack && Number.isFinite(value) && Number.isFinite(progress.maxPlayTime) && progress.maxPlayTime > 0) {
          global.app_event.setProgress(Math.max(0, Math.min(value, progress.maxPlayTime)))
        }
        break
      case 'favorite':
        if (hasTrack) { if (favorite) uncollectMusic(); else collectMusic() }
        break
      case 'search': goHome('nav_search'); break
      case 'bottomTab':
        if (value == 0) goHome()
        else if (value == 1) goHome('nav_search')
        else if (value == 2) goHome('nav_love')
        else if (value == 3) goHome('nav_setting')
        break
    }
  }

  const nativeLyrics = useMemo(() => lines.map(line => ({ time: line.time, text: line.text, translation: line.extendedLyrics.join('\n') })), [lines])
  const playerState = useMemo<NativePlayerProps['playerState']>(() => ({
    trackId: music.id ?? '',
    title: hasTrack ? music.name : '暂无播放歌曲',
    artist: hasTrack ? music.singer : '从搜索或我的音乐中选择一首歌曲',
    artwork: hasTrack && music.pic ? music.pic.startsWith('/') ? `file://${music.pic}` : music.pic : null,
    artworkUserAgent: defaultHeaders['User-Agent'],
    isPlaying: playback == State.Playing && hasTrack,
    hasTrack,
    isStopped: !hasTrack || playback == State.Stopped || playback == State.None,
    position: progress.nowPlayTime,
    duration: progress.maxPlayTime,
    favorite,
    status: !hasTrack ? '选择歌曲后即可播放' : playback == State.Buffering || playback == State.Connecting ? '缓冲中' : statusText,
    lyricsVisible,
    lyrics: nativeLyrics,
    activeLyric: lyric.line,
    seekRevision,
    immersiveVisualsEnabled,
    reactiveVisuals,
    particleQuality,
    lyricMotionEnabled,
    lyricPulseEnabled,
    lyricDisplayMode,
    lyricColor,
    lyricFontSize,
    lyricFontFamily,
    pageFontFamily,
    pageFontColor,
    lyricAlign,
    backgroundMotion,
    respectReducedMotion,
    wallpaperPath,
    wallpaperKind,
    wallpaperScope,
    playMode,
    topInset,
    bottomInset: 0,
  }), [music, hasTrack, playback, progress, favorite, statusText, topInset, lyricsVisible, nativeLyrics, lyric.line, seekRevision, playMode, immersiveVisualsEnabled, reactiveVisuals, particleQuality, lyricMotionEnabled, lyricPulseEnabled, lyricDisplayMode, lyricColor, lyricFontSize, lyricFontFamily, pageFontFamily, pageFontColor, lyricAlign, backgroundMotion, respectReducedMotion, wallpaperPath, wallpaperKind, wallpaperScope])

  return <>
    <NativeVinylPlayer style={{ flex: 1 }} playerState={playerState} onPlayerAction={({ nativeEvent }) => { handlePlayerAction(nativeEvent.action, nativeEvent.value) }} />
    <ArtistPicker ref={artistPicker} componentId={componentId} music={song} />
    <MusicAddModal ref={musicAdd} />
    <PlayerMoreSheet ref={lyricSettings} music={music} hasTrack={hasTrack} favorite={favorite}
      onAction={action => { handlePlayerAction(action, 0) }} />
  </>
}
