import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DeviceEventEmitter, ScrollView, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { State } from 'react-native-track-player'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { setNavActiveId } from '@/core/common'
import { getList } from '@/core/songlist'
import { getListMusics } from '@/core/list'
import { playLibraryMusic, getRecentTracks, LIBRARY_EVENT, type RecentTrack } from '@/core/music/library'
import { buildListeningProfile, getRecommendedSongs, getTopLanguage, rankRecommendedPlaylists, rankRecommendedTracks } from '@/core/music/recommendation'
import { playList, togglePlay } from '@/core/player/player'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { usePlaybackState } from '@/plugins/player/hook'
import { getSongListSetting } from '@/utils/data'
import { createStyle } from '@/utils/tools'
import { getDesignTokens } from '@/theme/design'
import { LIST_IDS } from '@/config/constant'
import { type ListInfoItem } from '@/store/songlist/state'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'

interface ListeningHomeProps {
  refreshKey: number
  onRefreshComplete: (key: number, part: 'catalog' | 'songs') => void
}

export default ({ refreshKey, onRefreshComplete }: ListeningHomeProps) => {
  const colors = getDesignTokens(useTheme())
  const t = useI18n()
  const current = usePlayerMusicInfo()
  const playback = usePlaybackState()
  const { width: windowWidth } = useWindowDimensions()
  const [playlists, setPlaylists] = useState<ListInfoItem[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [playlistRefreshToken, setPlaylistRefreshToken] = useState(0)
  const [songs, setSongs] = useState<LX.Music.MusicInfo[]>([])
  const [recent, setRecent] = useState<RecentTrack[]>([])
  const [recommendations, setRecommendations] = useState<LX.Music.MusicInfo[]>([])
  const [recommendationStatus, setRecommendationStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [recommendationSource, setRecommendationSource] = useState<LX.OnlineSource>('wy')
  const listId = LIST_IDS.LOVE
  const profile = useMemo(() => buildListeningProfile(recent), [recent])
  const rankedPlaylists = useMemo(() => rankRecommendedPlaylists(playlists, profile), [playlists, profile])
  const rankedSongs = useMemo(() => rankRecommendedTracks(recommendations, profile), [recommendations, profile])
  const songPages = useMemo(() => {
    const pages: Array<typeof rankedSongs> = []
    for (let i = 0; i < rankedSongs.length; i += 3) pages.push(rankedSongs.slice(i, i + 3))
    return pages
  }, [rankedSongs])
  const songPageWidth = Math.max(240, windowWidth - 36 - 30)
  const languageId = getTopLanguage(profile)
  const languageLabel = languageId == 'zh' ? t('ui_recommend_language_zh') : languageId == 'yue' ? t('ui_recommend_language_yue') : languageId == 'en' ? t('ui_recommend_language_en') : languageId == 'ja' ? t('ui_recommend_language_ja') : languageId == 'ko' ? t('ui_recommend_language_ko') : ''
  const recentRef = useRef(recent)
  const songsRef = useRef(songs)
  const recommendationHistoryRef = useRef(new Set<string>())
  recentRef.current = recent
  songsRef.current = songs
  const recommendationKey = recent.map(item => `${item.music.id}:${item.playedAt}:${item.playCount ?? 0}`).join('|')
  const favoriteKey = songs.map(song => song.id).join('|')
  const completeRefresh = useCallback((part: 'catalog' | 'songs') => {
    if (refreshKey > 0) onRefreshComplete(refreshKey, part)
  }, [refreshKey, onRefreshComplete])

  useEffect(() => {
    let active = true
    const loadRecent = () => { void getRecentTracks().then(items => { if (active) setRecent(items) }) }
    loadRecent()
    const listener = DeviceEventEmitter.addListener(LIBRARY_EVENT, loadRecent)
    return () => { active = false; listener.remove() }
  }, [])
  useEffect(() => {
    const listener = DeviceEventEmitter.addListener('lx_discoveryPlatformChanged', () => { setPlaylistRefreshToken(value => value + 1) })
    return () => { listener.remove() }
  }, [])

  useEffect(() => {
    recommendationHistoryRef.current.clear()
  }, [recommendationKey, favoriteKey, recommendationSource])

  useEffect(() => {
    let active = true
    setStatus('loading')
    void getSongListSetting().then(async setting => {
      if (active) setRecommendationSource(setting.source)
      return getList(setting.source, setting.tagId, setting.sortId, 1, refreshKey > 0 || playlistRefreshToken > 0)
    }).then(info => {
      if (!active) return
      setPlaylists(info.list.slice(0, 8))
      setStatus('ready')
    }).catch(() => { if (active) setStatus('error') }).finally(() => { if (active) completeRefresh('catalog') })
    return () => { active = false }
  }, [refreshKey, playlistRefreshToken, completeRefresh])

  useEffect(() => {
    let active = true
    if (!recentRef.current.length) {
      setRecommendations([])
      setRecommendationStatus('idle')
      completeRefresh('songs')
      return () => { active = false }
    }
    setRecommendationStatus('loading')
    const previouslyShownIds = [...recommendationHistoryRef.current]
    const savedIds = songsRef.current.map(song => song.id)
    const page = refreshKey ? refreshKey % 5 + 1 : 1
    void (async() => {
      let items = await getRecommendedSongs(recentRef.current, recommendationSource, [...savedIds, ...previouslyShownIds], page)
      if (!items.length && previouslyShownIds.length) {
        items = await getRecommendedSongs(recentRef.current, recommendationSource, savedIds, page)
        if (items.length) recommendationHistoryRef.current.clear()
      }
      if (!active) return
      const nextRecommendations = items.map(item => item.music)
      for (const music of nextRecommendations) recommendationHistoryRef.current.add(music.id)
      setRecommendations(nextRecommendations)
      setRecommendationStatus('ready')
    })().catch(() => { if (active) setRecommendationStatus('error') }).finally(() => { if (active) completeRefresh('songs') })
    return () => { active = false }
  }, [recommendationKey, favoriteKey, recommendationSource, refreshKey, completeRefresh])

  useEffect(() => {
    let active = true
    const load = () => {
      void getListMusics(LIST_IDS.LOVE).then(favorites => {
        if (!active) return
        setSongs([...favorites].slice(0, 6))
      }).catch(() => { if (active) setSongs([]) })
    }
    const update = (ids: string[]) => { if (ids.includes(LIST_IDS.LOVE) || ids.includes(LIST_IDS.DEFAULT)) load() }
    load()
    global.app_event.on('myListMusicUpdate', update)
    return () => { active = false; global.app_event.off('myListMusicUpdate', update) }
  }, [])

  const openPlaylist = (item: ListInfoItem) => {
    navigations.pushSonglistDetailScreen(commonState.componentIds.home!, item)
  }
  const play = (song: LX.Music.MusicInfo, index: number) => {
    if (current.id == song.id) togglePlay()
    else void playList(listId, index)
  }
  return (
    <View style={styles.container}>
      <View style={styles.sectionHead}>
        <Text size={19} style={styles.heading}>{languageLabel ? t('ui_recommend_songs_language', { language: languageLabel }) : t('ui_recommend_songs')}</Text>
      </View>
      {songPages.length ? (
        <ScrollView
          key={`song-recommendations-${refreshKey}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={songPageWidth}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
        >
          {songPages.map((page, pageIndex) => (
            <View key={`recommendation-page-${pageIndex}`} style={{ width: songPageWidth }}>
              {page.map(({ music }) => (
                <TouchableOpacity key={music.id} style={styles.song} activeOpacity={0.7} accessibilityRole="button"
                  accessibilityLabel={`${t(current.id == music.id && playback == State.Playing ? 'ui_pause' : 'ui_play')} ${music.name}`}
                  onPress={() => { if (current.id == music.id) togglePlay(); else void playLibraryMusic(music) }}>
                  <Image url={music.meta.picUrl} style={styles.songCover} />
                  <View style={styles.songInfo}>
                    <Text size={15} numberOfLines={1}>{music.name}</Text>
                    <Text size={12} numberOfLines={1} color={colors.muted} style={styles.singer}>{music.singer || t('ui_unknown_artist')}</Text>
                  </View>
                  <View style={styles.playTarget}>
                    <Icon name={current.id == music.id && playback == State.Playing ? 'pause' : 'play'} size={17} color={colors.text} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.recommendationState}>
          <Text size={13} color={colors.muted}>
            {recommendationStatus == 'loading' ? t('ui_recommend_loading') : recommendationStatus == 'error' ? t('ui_recommend_error') : recent.length ? t('ui_recommend_empty') : t('ui_recommend_start_listening')}
          </Text>
        </View>
      )}
      <View style={styles.sectionHead}>
        <Text size={19} style={styles.heading}>{t('ui_recommended_playlists')}</Text>
        <TouchableOpacity style={styles.more} accessibilityRole="button" onPress={() => { setNavActiveId('nav_songlist') }}>
          <Text size={12} color={colors.muted}>{t('ui_browse_all')}</Text>
          <Icon name="chevron-right" size={10} color={colors.muted} />
        </TouchableOpacity>
      </View>
      {rankedPlaylists.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.railContent}>
          {rankedPlaylists.map(item => (
            <TouchableOpacity key={`${item.source}_${item.id}`} style={styles.playlist} activeOpacity={0.75}
              accessibilityRole="button" accessibilityLabel={item.name} onPress={() => { openPlaylist(item) }}>
              <Image url={item.img} style={styles.playlistCover} />
              <Text size={15} numberOfLines={2} style={styles.playlistName}>{item.name}</Text>
              {item.author ? <Text size={11} numberOfLines={1} color={colors.muted}>{item.author}</Text> : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.catalogState}>
          <Text size={13} color={colors.muted}>{t(status == 'loading' ? 'ui_catalog_loading' : status == 'error' ? 'ui_catalog_error' : 'ui_catalog_empty')}</Text>
        </View>
      )}
      <View style={[styles.sectionHead, styles.libraryHead]}>
        <Text size={19} style={styles.heading}>{t('ui_favorite_songs')}</Text>
        <TouchableOpacity style={styles.more} accessibilityRole="button" onPress={() => { setNavActiveId('nav_love') }}>
          <Text size={12} color={colors.muted}>{t('ui_browse_all')}</Text>
          <Icon name="chevron-right" size={10} color={colors.muted} />
        </TouchableOpacity>
      </View>
      {songs.length ? songs.map((song, index) => (
        <TouchableOpacity key={song.id} style={styles.song} activeOpacity={0.7} accessibilityRole="button"
          accessibilityLabel={`${t(current.id == song.id && playback == State.Playing ? 'ui_pause' : 'ui_play')} ${song.name}`}
          onPress={() => { play(song, index) }}>
          <Image url={song.meta.picUrl} style={styles.songCover} />
          <View style={styles.songInfo}>
            <Text size={16} numberOfLines={1}>{song.name}</Text>
            <Text size={12} numberOfLines={1} color={colors.muted} style={styles.singer}>{song.singer || t('ui_unknown_artist')}</Text>
          </View>
          <View style={styles.playTarget}>
            <Icon name={current.id == song.id && playback == State.Playing ? 'pause' : 'play'} size={17} color={colors.text} />
          </View>
        </TouchableOpacity>
      )) : <Text size={13} color={colors.muted} style={styles.empty}>{t('ui_library_empty')}</Text>}
    </View>
  )
}

const styles = createStyle({
  container: { paddingTop: 12, paddingBottom: 24 },
  sectionHead: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heading: { fontWeight: '500', flexShrink: 1 },
  more: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6 },
  rail: { marginHorizontal: -18, marginTop: 8 },
  railContent: { paddingHorizontal: 18, gap: 12 },
  playlist: { width: 144 },
  playlistCover: { width: 144, height: 160, borderRadius: 4 },
  playlistName: { lineHeight: 21, marginTop: 9, marginBottom: 4 },
  catalogState: { minHeight: 92, justifyContent: 'center', alignItems: 'flex-start' },
  libraryHead: { marginTop: 26, marginBottom: 10 },
  song: { minHeight: 66, flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  songCover: { width: 48, height: 48, borderRadius: 4 },
  songInfo: { flex: 1, paddingLeft: 12, paddingRight: 6 },
  singer: { marginTop: 3 },
  playTarget: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  recommendationState: { minHeight: 92, justifyContent: 'center', alignItems: 'flex-start' },
  empty: { paddingTop: 10, paddingBottom: 24, lineHeight: 22 },
})
