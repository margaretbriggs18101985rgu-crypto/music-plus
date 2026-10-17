import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { requireNativeComponent, type NativeSyntheticEvent, type ViewProps } from 'react-native'
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
import { toast } from '@/utils/tools'
import { defaultHeaders } from '@/components/common/Image'
import { showPlaybackQueue } from '@/components/player/PlaybackQueue'
import { showPlayerTool } from '@/components/player/PlayerTools'
import { useSettingValue } from '@/store/setting/hook'
import { useLrcSet, useLrcPlay } from '@/plugins/lyric'
import ArtistPicker, { type ArtistPickerRef } from '../components/ArtistPicker'

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
  const [lyricsVisible, setLyricsVisible] = useState(false)
  const music = usePlayerMusicInfo()
  const current = usePlayMusicInfo()
  const artistPicker = useRef<ArtistPickerRef>(null)
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
      statusBar: { style: 'light', backgroundColor: 'transparent' },
      navigationBar: { backgroundColor: '#2A292D' },
    })
  }, [componentId])

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

  const onPlayerAction = ({ nativeEvent: { action, value } }: NativeSyntheticEvent<PlayerActionEvent>) => {
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
      case 'info': if (hasTrack) showPlayerTool('info'); break
      case 'download': if (hasTrack) showPlayerTool('download'); break
      case 'toggle': if (hasTrack) togglePlay(); break
      case 'previous': if (hasTrack) void playPrev(); break
      case 'next': if (hasTrack) void playNext(); break
      case 'seek':
        if (hasTrack && progress.maxPlayTime > 0) global.app_event.setProgress(Math.max(0, Math.min(value, progress.maxPlayTime)))
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
    lyrics: lines.map(line => ({ time: line.time, text: line.text, translation: line.extendedLyrics.join('\n') })),
    activeLyric: lyric.line,
    playMode,
    topInset,
    bottomInset: 0,
  }), [music, hasTrack, playback, progress, favorite, statusText, topInset, lyricsVisible, lines, lyric.line, playMode])

  return <>
    <NativeVinylPlayer style={{ flex: 1 }} playerState={playerState} onPlayerAction={onPlayerAction} />
    <ArtistPicker ref={artistPicker} componentId={componentId} music={song} />
  </>
}
