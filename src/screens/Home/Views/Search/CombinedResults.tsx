import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import OnlineList, { type OnlineListType } from '@/components/OnlineList'
import InlineOptions from '@/components/common/InlineOptions'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { searchCombined, sortedSongs, sortedPlaylists, enrichSearchDates, filterCombinedSearch, type CombinedSearch, type SearchSort, type SearchSource } from '@/core/search/combined'
import { useTheme } from '@/store/theme/hook'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import searchState from '@/store/search/state'
import { toast } from '@/utils/tools'

export interface CombinedResultsType { loadList: (text: string, source?: string) => void }
const sortOptions = [{ value: 'relevance', label: '综合匹配' }, { value: 'hot', label: '热度优先' }, { value: 'newest', label: '发布时间' }] as const
const sourceOptions = [{ value: 'all', label: '综合' }, { value: 'tx', label: 'QQ音乐' }, { value: 'wy', label: '网易云音乐' }] as const

export default forwardRef<CombinedResultsType, {}>((props, ref) => {
  const list = useRef<OnlineListType>(null)
  const generation = useRef(0)
  const loading = useRef(false)
  const selection = useRef({ text: '', sort: 'relevance' as SearchSort, source: 'all' as SearchSource })
  const resultRef = useRef<CombinedSearch>()
  const [result, setResult] = useState<CombinedSearch>()
  const [sort, setSort] = useState<SearchSort>('relevance')
  const [source, setSource] = useState<SearchSource>('all')
  const [keyword, setKeyword] = useState('')
  const [sorting, setSorting] = useState(false)
  const theme = useTheme()
  const apply = (data: CombinedSearch, append = false) => {
    resultRef.current = data
    setResult(data)
    const visible = filterCombinedSearch(data, selection.current.source)
    list.current?.setList(sortedSongs(visible.songs, selection.current.sort, selection.current.text, visible.artists).map(item => item.music), append, true)
    list.current?.setStatus(Object.values(visible.more).some(Boolean) ? 'idle' : 'end')
  }
  const load = async(text: string, page = 1) => {
    const request = ++generation.current
    loading.current = true
    setSorting(false)
    selection.current.text = text
    searchState.searchText = text
    setKeyword(text)
    if (page == 1) {
      resultRef.current = undefined
      setResult(undefined)
      list.current?.setList([], false, true)
    }
    list.current?.setStatus('loading')
    try {
      const data = await searchCombined(text, page, resultRef.current)
      if (selection.current.sort == 'newest') data.songs = await enrichSearchDates(data.songs)
      if (request == generation.current) apply(data, page > 1)
    } catch (error) {
      if (request == generation.current) {
        list.current?.setStatus('error')
        toast(error instanceof Error ? error.message : '搜索失败，请重试')
      }
    } finally { if (request == generation.current) loading.current = false }
  }
  useImperativeHandle(ref, () => ({ loadList: text => { void load(text) } }))
  useEffect(() => () => { generation.current++ }, [])
  const changeSource = (next: SearchSource) => {
    selection.current.source = next
    setSource(next)
    if (resultRef.current) apply(resultRef.current)
  }
  const changeSort = (next: SearchSort) => {
    selection.current.sort = next
    setSort(next)
    if (resultRef.current) apply(resultRef.current)
    setSorting(false)
    if (next == 'newest' && resultRef.current) {
      const request = generation.current
      const original = resultRef.current
      setSorting(true)
      void enrichSearchDates(original.songs).then(songs => {
        if (request != generation.current || selection.current.sort != 'newest' || resultRef.current != original) return
        apply({ ...original, songs })
      }).finally(() => { if (request == generation.current) setSorting(false) })
    }
  }
  const visible = result ? filterCombinedSearch(result, source) : undefined
  const playlists = sortedPlaylists(visible?.playlists ?? [], sort, keyword)
  return <View style={{ flex: 1 }}>
    <View style={{ paddingHorizontal: 18 }}>
      <InlineOptions value={source} options={sourceOptions} onChange={changeSource} />
      <InlineOptions value={sort} options={sortOptions} onChange={changeSort} />
      {sorting ? <Text size={11} color={theme['c-font-label']}>正在补充官方发行日期…</Text> : null}
    </View>
    <OnlineList ref={list} checkHomePagerIdle
    onRefresh={() => { void load(selection.current.text) }}
    onLoadMore={() => {
      if (loading.current || (resultRef.current && !Object.values(filterCombinedSearch(resultRef.current, selection.current.source).more).some(Boolean))) return
      void load(selection.current.text, (resultRef.current?.page ?? 0) + 1)
    }}
    ListHeaderComponent={<View style={{ paddingHorizontal: 18 }}>
      <Text size={11} color={theme['c-font-label']} style={{ marginBottom: 10 }}>{source == 'all' ? 'QQ音乐 + 网易云' : source == 'tx' ? 'QQ音乐' : '网易云音乐'} · 对已加载结果排序{sort == 'relevance' ? ' · 匹配歌手、歌名与版本' : sort == 'hot' ? ' · 按平台内热度综合比较' : ''}{sort != 'relevance' ? ' · 缺失数据置后' : ''}</Text>
      {visible?.failures.length ? <TouchableOpacity accessibilityRole="button" onPress={() => { void load(selection.current.text) }} style={{ minHeight: 44, justifyContent: 'center' }}><Text size={12} color={theme['c-font-label']}>部分平台结果获取失败，点击重试</Text></TouchableOpacity> : null}
      {visible?.artists.map(({ artist }) => <TouchableOpacity key={`${artist.source}_${artist.id}`} accessibilityRole="button" accessibilityLabel={`打开 ${artist.name} 的歌手主页`}
        onPress={() => { void navigations.pushArtistScreen(commonState.componentIds.home!, artist).catch(() => { toast('歌手主页打开失败') }) }}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, minHeight: 72 }}>
        <Image url={artist.avatar} style={{ width: 48, height: 48, borderRadius: 24 }} />
        <View style={{ marginLeft: 12, flex: 1 }}><Text size={15}>{artist.name}</Text><Text size={11} color={theme['c-font-label']}>歌手 · {artist.source == 'wy' ? '网易云音乐' : 'QQ音乐'}</Text></View>
      </TouchableOpacity>)}
      {playlists.length ? <><Text size={16} style={{ marginVertical: 10 }}>歌单 · {playlists.length}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
          {playlists.map(item => <TouchableOpacity key={`${item.source}_${item.id}`} accessibilityRole="button" accessibilityLabel={`打开歌单 ${item.name}`}
            onPress={() => { navigations.pushSonglistDetailScreen(commonState.componentIds.home!, item) }} style={{ width: 128, paddingBottom: 14 }}>
            <Image url={item.img} style={{ width: 128, height: 128, borderRadius: 5 }} />
            <Text size={13} numberOfLines={2} style={{ marginTop: 6 }}>{item.name}</Text>
            <Text size={10} color={theme['c-font-label']} numberOfLines={1}>{item.source == 'wy' ? '网易云音乐' : 'QQ音乐'}{sort == 'newest' && item.time ? ` · ${item.time}` : sort == 'hot' && item.play_count ? ` · ${item.play_count}次` : ''}</Text>
          </TouchableOpacity>)}
        </ScrollView></> : null}
      {visible ? <Text size={16} style={{ marginVertical: 10 }}>歌曲 · {visible.songs.length}</Text> : null}
    </View>}
    />
  </View>
})
