import { useCallback } from 'react'
import { FlatList, RefreshControl, TouchableOpacity, View } from 'react-native'
import PageContent from '@/components/PageContent'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import StatusBar from '@/components/common/StatusBar'
import { Icon } from '@/components/common/Icon'
import PlayerBar from '@/components/player/PlayerBar'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { getDesignTokens } from '@/theme/design'
import { getArtistAllSongs, type Artist, type MusicPage } from '@/core/music/artist'
import { pop } from '@/navigation'
import usePagedContent from './usePagedContent'
import { LoadState, PlayAll, SongRow } from './components'

export default ({ componentId, artist }: { componentId: string, artist: Artist }) => {
  const colors = getDesignTokens(useTheme())
  const inset = useStatusbarHeight()
  const fetchSongs = useCallback(async(offset: number) => getArtistAllSongs(artist, offset), [artist])
  // Load the full catalog in pages, rendering the first page immediately while the rest arrives.
  const music = usePagedContent<LX.Music.MusicInfoOnline, MusicPage>(fetchSongs, true)
  const complete = !music.loading && !music.more && !music.error
  const progress = complete ? `共 ${music.list.length} 首歌曲` : `已加载 ${music.list.length} 首${music.firstPage?.total != null ? ` / 共 ${music.firstPage.total} 首` : ''}`
  return <PageContent><StatusBar />
    <View style={{ flex: 1, paddingTop: inset, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', minHeight: 48, alignItems: 'center', paddingHorizontal: 8 }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="返回歌手主页" onPress={() => { void pop(componentId) }} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><Icon name="chevron-left" size={25} /></TouchableOpacity>
        <Text size={16} style={{ flex: 1, textAlign: 'center', marginRight: 48 }}>全部歌曲</Text>
      </View>
      <FlatList data={music.list} keyExtractor={item => item.id} renderItem={({ item, index }) => <SongRow item={item} index={index} list={music.list} />}
        ListHeaderComponent={<>
          <View style={{ paddingHorizontal: 24, paddingVertical: 22, flexDirection: 'row', alignItems: 'center' }}>
            <Image url={artist.avatar} style={{ width: 76, height: 76, borderRadius: 38, marginRight: 18 }} />
            <View style={{ flex: 1 }}><Text size={24} style={{ fontWeight: '600' }}>{artist.name}</Text><Text size={12} color={colors.muted} style={{ marginTop: 10 }}>{artist.source == 'wy' ? '网易云音乐' : 'QQ音乐'} · 全部作品</Text></View>
          </View>
          <PlayAll list={music.list} label="播放全部歌曲" disabled={!complete} subtitle={progress} />
          {music.loading ? <Text size={12} color={colors.muted} style={{ paddingHorizontal: 24, paddingBottom: 16 }}>正在加载完整目录，已加载的歌曲可直接播放…</Text> : null}
          {music.error && music.list.length ? <View style={{ paddingHorizontal: 24 }}><LoadState loading={false} error={music.error} empty={false} retry={music.retry} /></View> : null}
        </>}
        refreshControl={<RefreshControl refreshing={music.refreshing} onRefresh={music.refresh} colors={[colors.text]} tintColor={colors.text} />}
        onEndReachedThreshold={0.3} onEndReached={music.loadMore}
        ListFooterComponent={<LoadState loading={music.loading} error={music.error} empty={!music.list.length} retry={music.retry} />} />
      <PlayerBar componentId={componentId} />
    </View>
  </PageContent>
}
