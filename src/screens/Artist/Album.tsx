import { useCallback } from 'react'
import { FlatList, Linking, RefreshControl, TouchableOpacity, View } from 'react-native'
import PageContent from '@/components/PageContent'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import StatusBar from '@/components/common/StatusBar'
import { Icon } from '@/components/common/Icon'
import PlayerBar from '@/components/player/PlayerBar'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { getDesignTokens } from '@/theme/design'
import { albumUrl, getAlbumSongs, type ArtistAlbum, type MusicPage } from '@/core/music/artist'
import { pop } from '@/navigation'
import { toast } from '@/utils/tools'
import usePagedContent from './usePagedContent'
import { LoadState, PlayAll, SongRow } from './components'

export default ({ componentId, album }: { componentId: string, album: ArtistAlbum }) => {
  const theme = useTheme()
  const colors = getDesignTokens(theme)
  const inset = useStatusbarHeight()
  const fetchSongs = useCallback(async(offset: number) => getAlbumSongs(album, offset), [album])
  const music = usePagedContent<LX.Music.MusicInfoOnline, MusicPage>(fetchSongs)
  return <PageContent><StatusBar />
    <View style={{ flex: 1, paddingTop: inset, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', minHeight: 48, alignItems: 'center', paddingHorizontal: 8 }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="返回歌手主页" onPress={() => { void pop(componentId) }} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><Icon name="chevron-left" size={25} /></TouchableOpacity>
        <Text size={15} style={{ flex: 1, textAlign: 'center', marginRight: 48 }}>专辑</Text>
      </View>
      <FlatList data={music.list} keyExtractor={item => item.id} renderItem={({ item, index }) => <SongRow item={item} index={index} list={music.list} />}
        ListHeaderComponent={<>
          <View style={{ paddingHorizontal: 24, paddingTop: 20, alignItems: 'center' }}>
            <Image url={album.cover} style={{ width: '68%', maxWidth: 280, aspectRatio: 1, borderRadius: 12 }} />
            <Text size={25} style={{ fontWeight: '600', marginTop: 25, textAlign: 'center' }}>{album.name}</Text>
            <Text size={12} color={colors.muted} style={{ marginTop: 10 }}>{[album.published, `${album.source == 'wy' ? '网易云音乐' : 'QQ音乐'} · 专辑`].filter(Boolean).join(' · ')}</Text>
            <TouchableOpacity accessibilityRole="link" onPress={() => { void Linking.openURL(albumUrl(album)).catch(() => { toast('暂时无法打开官方专辑页') }) }} style={{ minHeight: 48, justifyContent: 'center' }}><Text size={12} color={colors.muted}>查看官方专辑 ↗</Text></TouchableOpacity>
          </View>
          <PlayAll list={music.list} label="播放专辑" />
        </>}
        refreshControl={<RefreshControl refreshing={music.refreshing} onRefresh={music.refresh} colors={[colors.text]} tintColor={colors.text} />}
        onEndReachedThreshold={0.3} onEndReached={music.loadMore}
        ListFooterComponent={<LoadState loading={music.loading} error={music.error} empty={!music.list.length} retry={music.retry} />} />
      <PlayerBar componentId={componentId} />
    </View>
  </PageContent>
}
