import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import OnlineList, { type OnlineListType, type OnlineListProps } from '@/components/OnlineList'
import { search } from '@/core/search/music'
import searchMusicState, { type Source } from '@/store/search/music/state'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { searchArtist, type ArtistSearchResult } from '@/core/music/artist'
import { useTheme } from '@/store/theme/hook'
import { getDesignTokens } from '@/theme/design'
import commonState from '@/store/common/state'
import { navigations } from '@/navigation'
import { toast } from '@/utils/tools'

// export type MusicListProps = Pick<OnlineListProps,
// 'onLoadMore'
// | 'onPlayList'
// | 'onRefresh'
// >

export interface MusicListType {
  loadList: (text: string, source: Source) => void
}

export default forwardRef<MusicListType, {}>((props, ref) => {
  const listRef = useRef<OnlineListType>(null)
  const searchInfoRef = useRef<{ text: string, source: Source }>({ text: '', source: 'kw' })
  const isUnmountedRef = useRef(false)
  const artistRequestRef = useRef(0)
  const [artistResult, setArtistResult] = useState<ArtistSearchResult | null>(null)
  const loadArtist = (text: string, source: Source) => {
    const request = ++artistRequestRef.current
    setArtistResult(null)
    if (!text.trim()) return
    void searchArtist(text, source).then(result => {
      if (!isUnmountedRef.current && request == artistRequestRef.current) setArtistResult(result)
    }).catch(() => {})
  }
  useImperativeHandle(ref, () => ({
    async loadList(text, source) {
      searchInfoRef.current = { text, source }
      loadArtist(text, source)
      // const listDetailInfo = searchMusicState.listDetailInfo
      listRef.current?.setList([], false, source == 'all')
      if (searchMusicState.searchText == text && searchMusicState.source == source && searchMusicState.listInfos[searchMusicState.source]!.list.length) {
        requestAnimationFrame(() => {
          listRef.current?.setList(searchMusicState.listInfos[searchMusicState.source]!.list, false, source == 'all')
        })
      } else {
        listRef.current?.setStatus('loading')
        const page = 1
        searchInfoRef.current.text = text
        searchInfoRef.current.source = source
        return search(text, page, source).then((list) => {
          // const result = setListInfo(listDetail, id, page)
          if (isUnmountedRef.current) return
          requestAnimationFrame(() => {
            listRef.current?.setList(list, false, source == 'all')
            listRef.current?.setStatus(searchMusicState.listInfos[searchMusicState.source]!.maxPage <= page ? 'end' : 'idle')
          })
        }).catch(() => {
          listRef.current?.setStatus('error')
        })
      }
    },
  }), [])

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])


  const handleRefresh: OnlineListProps['onRefresh'] = () => {
    const page = 1
    loadArtist(searchInfoRef.current.text, searchInfoRef.current.source)
    listRef.current?.setStatus('refreshing')
    search(searchInfoRef.current.text, page, searchInfoRef.current.source).then((list) => {
      // const result = setListInfo(listDetail, searchMusicState.listDetailInfo.id, page)
      if (isUnmountedRef.current) return
      listRef.current?.setList(list, false, searchInfoRef.current.source == 'all')
      listRef.current?.setStatus(searchMusicState.listInfos[searchInfoRef.current.source]!.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      listRef.current?.setStatus('error')
    })
  }
  const handleLoadMore: OnlineListProps['onLoadMore'] = () => {
    listRef.current?.setStatus('loading')
    const info = searchMusicState.listInfos[searchInfoRef.current.source]!
    const page = info?.list.length ? info.page + 1 : 1
    search(searchInfoRef.current.text, page, searchInfoRef.current.source).then((list) => {
      // const result = setListInfo(listDetail, searchMusicState.listDetailInfo.id, page)
      if (isUnmountedRef.current) return
      listRef.current?.setList(list, true, searchInfoRef.current.source == 'all')
      listRef.current?.setStatus(info.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      listRef.current?.setStatus('error')
    })
  }

  return <OnlineList
    ref={listRef}
    onRefresh={handleRefresh}
    onLoadMore={handleLoadMore}
    ListHeaderComponent={artistResult ? <ArtistSearchCard result={artistResult} /> : null}
    checkHomePagerIdle
  />
})

const ArtistSearchCard = ({ result }: { result: ArtistSearchResult }) => {
  const theme = useTheme()
  const colors = getDesignTokens(theme)
  const { artist, aliases, songCount, albumCount } = result
  const openArtist = () => {
    const homeId = commonState.componentIds.home
    if (!homeId) return
    void navigations.pushArtistScreen(homeId, artist).catch(() => { toast('歌手主页打开失败，请重试') })
  }
  const details = [artist.source == 'wy' ? '网易云音乐' : 'QQ音乐', songCount != null ? `${songCount} 首歌曲` : '', albumCount != null ? `${albumCount} 张专辑` : ''].filter(Boolean).join(' · ')
  return <View style={{ paddingHorizontal: 18, paddingTop: 4 }}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`打开 ${artist.name} 的歌手主页`} onPress={openArtist} activeOpacity={0.72}
      style={{ minHeight: 92, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Image url={artist.avatar} style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: colors.surface }} />
      <View style={{ flex: 1, minWidth: 0, marginLeft: 15, marginRight: 10 }}>
        <Text size={12} color={colors.muted} numberOfLines={1}>歌手主页 · {artist.source == 'wy' ? '网易云音乐' : 'QQ音乐'}</Text>
        <Text size={16} numberOfLines={1} style={{ marginTop: 4, fontWeight: '600' }}>
          <Text size={16} color={colors.accent} style={{ fontWeight: '600' }}>{artist.name}</Text>
          {aliases[0] ? <Text size={14} color={colors.muted}> ({aliases[0]})</Text> : null}
        </Text>
        <Text size={12} color={colors.muted} numberOfLines={1} style={{ marginTop: 4 }}>{details}</Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.muted} />
    </TouchableOpacity>
  </View>
}

