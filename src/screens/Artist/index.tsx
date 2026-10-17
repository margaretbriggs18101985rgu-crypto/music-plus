import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, FlatList, Image as NativeImage, Linking, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import PageContent from '@/components/PageContent'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import StatusBar from '@/components/common/StatusBar'
import { Icon } from '@/components/common/Icon'
import PlayerBar from '@/components/player/PlayerBar'
import SceneTransition from '@/components/common/SceneTransition'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { artistUrl, getArtistAlbums, getArtistBiography, getArtistIdentity, getArtistProfile, getArtistSongs, type AlbumPage, type Artist, type ArtistAlbum, type ArtistBiography, type ArtistProfile, type MusicPage } from '@/core/music/artist'
import { navigations, pop } from '@/navigation'
import { toast } from '@/utils/tools'
import { getDesignTokens } from '@/theme/design'
import usePagedContent from './usePagedContent'
import { LoadState, PlayAll, SongRow } from './components'

type Tab = 'music' | 'albums' | 'about'
interface ArtistMusicPage extends MusicPage { profile?: ArtistProfile }
export default ({ componentId, artist }: { componentId: string, artist: Artist }) => {
  const theme = useTheme()
  const colors = getDesignTokens(theme)
  const inset = useStatusbarHeight()
  const [tab, setTab] = useState<Tab>('music')
  const [identity, setIdentity] = useState(artist)
  useEffect(() => {
    let active = true
    void getArtistIdentity(artist).then(value => { if (active) setIdentity(value) }).catch(() => {})
    return () => { active = false }
  }, [artist])
  const headerOpacity = useRef(new Animated.Value(0)).current
  const collapsed = useRef(false)
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = event.nativeEvent.contentOffset.y > 260
    if (collapsed.current == next) return
    collapsed.current = next
    Animated.timing(headerOpacity, { toValue: next ? 1 : 0, duration: 180, useNativeDriver: true }).start()
  }, [headerOpacity])
  useEffect(() => { collapsed.current = false; headerOpacity.setValue(0) }, [tab, headerOpacity])
  const fetchMusic = useCallback(async(offset: number): Promise<ArtistMusicPage> => {
    if (offset) return getArtistSongs(artist, offset)
    const profile = await getArtistProfile(artist)
    return { ...profile.songs, profile }
  }, [artist])
  const music = usePagedContent<LX.Music.MusicInfoOnline, ArtistMusicPage>(fetchMusic)
  const profile = music.firstPage?.profile
  const info = { ...artist, ...profile?.artist, ...identity, avatar: identity.avatar ?? profile?.artist.avatar, cover: identity.cover ?? profile?.artist.cover }
  const openOfficial = () => { void Linking.openURL(artistUrl(artist)).catch(() => { toast('暂时无法打开官方歌手页') }) }
  const tabs = <View style={[styles.tabs, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
    {([['music', '音乐'], ['albums', '专辑'], ['about', '简介']] as const).map(([id, label]) => <TouchableOpacity key={id} accessibilityRole="tab" accessibilityState={{ selected: tab == id }} onPress={() => { setTab(id) }} style={styles.tab}>
      <Text size={17} color={tab == id ? colors.text : colors.muted} style={{ fontWeight: tab == id ? '600' : '400' }}>{label}</Text>
      <View style={{ marginTop: 12, height: 3, width: 24, borderRadius: 2, backgroundColor: tab == id ? colors.text : 'transparent' }} />
    </TouchableOpacity>)}
  </View>
  const hero = <View style={{ backgroundColor: colors.background }}>
    <View style={{ height: 350 + inset, backgroundColor: colors.surface, overflow: 'hidden' }}>
      <Image url={info.cover ?? info.avatar} style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#00000018' }]} />
      <NativeImage source={require('@/resources/images/artist-fade.png')} resizeMode="stretch" style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: 190, tintColor: colors.background }} />
      <NativeImage source={require('@/resources/images/artist-fade.png')} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: inset + 100, tintColor: '#000000', opacity: 0.6, transform: [{ rotate: '180deg' }] }} />
      <View style={{ position: 'absolute', bottom: 16, left: 24, right: 24 }}>
        <Text size={32} numberOfLines={2} color={colors.text} style={{ fontWeight: '700', textShadowColor: '#0008', textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 } }}>{info.name}</Text>
      </View>
    </View>
    <View style={{ paddingHorizontal: 24, paddingBottom: 22 }}>
      <Text size={12} color={colors.muted}>{artist.source == 'wy' ? '网易云音乐' : 'QQ音乐'} · 歌手主页</Text>
      <View style={{ flexDirection: 'row', marginTop: 18, gap: 30 }}>
        <View><Text size={21} style={{ fontWeight: '600' }}>{profile?.songCount ?? '—'}</Text><Text size={11} color={colors.muted} style={{ marginTop: 4 }}>歌曲</Text></View>
        {profile?.albumCount != null ? <View><Text size={21} style={{ fontWeight: '600' }}>{profile.albumCount}</Text><Text size={11} color={colors.muted} style={{ marginTop: 4 }}>专辑</Text></View> : null}
        <TouchableOpacity accessibilityRole="link" accessibilityLabel="查看官方歌手主页" onPress={openOfficial} style={{ marginLeft: 'auto', minHeight: 44, paddingHorizontal: 17, borderRadius: 24, backgroundColor: colors.surface, justifyContent: 'center' }}><Text size={12}>官方主页 ↗</Text></TouchableOpacity>
      </View>
    </View>
  </View>
  const header = <>{hero}{tabs}</>
  return <PageContent>
    <StatusBar />
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SceneTransition sceneKey={tab} direction="fade">
        {tab == 'music' ? <FlatList data={music.list} keyExtractor={item => item.id} ListHeaderComponent={<>{header}<PlayAll list={music.list} label={`播放热门 ${music.list.length || 50} 首`}
          action={<TouchableOpacity accessibilityRole="button" accessibilityLabel="加载歌手的全部歌曲" onPress={() => { void navigations.pushArtistSongsScreen(componentId, info).catch(() => { toast('全部歌曲页面打开失败，请重试') }) }} style={{ minHeight: 44, paddingHorizontal: 14, marginLeft: 8, borderRadius: 22, backgroundColor: colors.surface, justifyContent: 'center' }}><Text size={12}>全部歌曲 ›</Text></TouchableOpacity>} /></>}
        onScroll={onScroll} scrollEventThrottle={32}
        renderItem={({ item, index }) => <SongRow item={item} index={index} list={music.list} />} contentContainerStyle={{ paddingBottom: 12 }}
        refreshControl={<RefreshControl refreshing={music.refreshing} onRefresh={music.refresh} colors={[colors.text]} tintColor={colors.text} />}
        onEndReachedThreshold={0.3} onEndReached={music.loadMore}
        ListFooterComponent={<LoadState loading={music.loading} error={music.error} empty={!music.list.length} retry={music.retry} />} />
          : tab == 'albums' ? <Albums artist={artist} componentId={componentId} header={header} onScroll={onScroll} />
            : <Biography artist={artist} header={header} fallback={profile?.description ?? ''} onScroll={onScroll} />}
      </SceneTransition>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: inset + 48, backgroundColor: colors.background, opacity: headerOpacity, justifyContent: 'flex-end', paddingBottom: 14 }}>
        <Text size={15} numberOfLines={1} style={{ textAlign: 'center', marginHorizontal: 64 }}>{info.name}</Text>
      </Animated.View>
      <View style={{ position: 'absolute', top: inset, left: 0, right: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }} pointerEvents="box-none">
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="返回歌曲页面" onPress={() => { void pop(componentId) }} style={[styles.back, styles.heroButton]}><Icon name="chevron-left" size={23} color="#FFFFFF" /></TouchableOpacity>
        <View style={{ flex: 1 }} pointerEvents="none" />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="刷新歌手资料" onPress={music.refresh} style={[styles.back, styles.heroButton]}><Icon name="available_updates" size={18} color="#FFFFFF" /></TouchableOpacity>
      </View>
      <PlayerBar componentId={componentId} />
    </View>
  </PageContent>
}

const Biography = ({ artist, header, fallback, onScroll }: { artist: Artist, header: React.ReactElement, fallback: string, onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void }) => {
  const theme = useTheme()
  const [biography, setBiography] = useState<ArtistBiography>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    void getArtistBiography(artist).then(result => { if (active) setBiography(result) })
      .catch(() => { if (active) setError('歌手简介暂时无法加载') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [artist, reload])
  const summary = biography?.summary || fallback // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
  return <ScrollView contentContainerStyle={{ paddingBottom: 28 }} onScroll={onScroll} scrollEventThrottle={32}>{header}<View style={{ padding: 24 }}>
    <Text size={17} style={{ fontWeight: '600', marginBottom: 16 }}>关于 {artist.name}</Text>
    <LoadState loading={loading} error={error} empty={false} retry={() => { setReload(value => value + 1) }} />
    {summary || !loading ? <Text size={14} color={theme['c-font-label']} style={{ lineHeight: 26 }}>{summary || '平台暂未提供公开简介，可前往官方主页查看更多歌手资料。'}</Text> : null}
    {biography?.sections.map((section, index) => <View key={index} style={{ marginTop: 28 }}><Text size={17} style={{ fontWeight: '600', marginBottom: 12 }}>{section.title}</Text><Text size={14} color={theme['c-font-label']} style={{ lineHeight: 26 }}>{section.text}</Text></View>)}
  </View></ScrollView>
}

const Albums = ({ artist, componentId, header, onScroll }: { artist: Artist, componentId: string, header: React.ReactElement, onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void }) => {
  const theme = useTheme()
  const colors = getDesignTokens(theme)
  const fetchAlbums = useCallback(async(offset: number) => getArtistAlbums(artist, offset), [artist])
  const albums = usePagedContent<ArtistAlbum, AlbumPage>(fetchAlbums)
  return <FlatList data={albums.list} keyExtractor={item => item.id} numColumns={2} ListHeaderComponent={header} columnWrapperStyle={{ paddingHorizontal: 20, gap: 16 }} onScroll={onScroll} scrollEventThrottle={32}
    renderItem={({ item }) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`查看专辑 ${item.name}`} onPress={() => { void navigations.pushAlbumScreen(componentId, item).catch(() => { toast('专辑页面打开失败，请重试') }) }} style={{ flex: 1, maxWidth: '50%', marginBottom: 24, marginTop: 18 }}>
      <Image url={item.cover} style={{ width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: colors.surface }} />
      <Text size={14} numberOfLines={2} style={{ marginTop: 12, lineHeight: 21 }}>{item.name}</Text>
      <Text size={11} color={colors.muted} style={{ marginTop: 5 }}>{[item.published, item.count != null ? `${item.count} 首` : ''].filter(Boolean).join(' · ') || '专辑'}</Text>
    </TouchableOpacity>}
    refreshControl={<RefreshControl refreshing={albums.refreshing} onRefresh={albums.refresh} colors={[colors.text]} tintColor={colors.text} />}
    onEndReachedThreshold={0.3} onEndReached={albums.loadMore}
    ListFooterComponent={<LoadState loading={albums.loading} error={albums.error} empty={!albums.list.length} retry={albums.retry} />} />
}
const styles = StyleSheet.create({
  back: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  heroButton: { borderRadius: 24, backgroundColor: '#00000035' },
  tabs: { flexDirection: 'row', paddingTop: 15, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'flex-end' },
})
