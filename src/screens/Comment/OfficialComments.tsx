import { useEffect, useRef, useState } from 'react'
import { FlatList, Linking, RefreshControl, TouchableOpacity, View } from 'react-native'
import InlineOptions, { OFFICIAL_PLATFORMS } from '@/components/common/InlineOptions'
import PageContent from '@/components/PageContent'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import { useTheme } from '@/store/theme/hook'
import playerState from '@/store/player/state'
import { resolveOfficialTrack } from '@/core/music/officialInfo'
import musicSdk from '@/utils/musicSdk'
import { toOldMusicInfo } from '@/utils'
import { pop } from '@/navigation'
import { useStatusbarHeight } from '@/store/common/hook'
import StatusBar from '@/components/common/StatusBar'
import CommentFloor from './components/CommentFloor'
import { filterList, type Comment, type CommentInfo } from './utils'

type Source = 'wy' | 'tx'
type Sort = 'hot' | 'new'
type OfficialCommentInfo = Omit<CommentInfo, 'total'> & { total: number | null }
const currentMusic = () => {
  const original = playerState.playMusicInfo.musicInfo
  return original && ('progress' in original ? original.metadata.musicInfo : original)
}
export default ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const inset = useStatusbarHeight()
  const [song, setSong] = useState(currentMusic)
  const [source, setSource] = useState<Source>(song?.source == 'tx' ? 'tx' : 'wy')
  const [sort, setSort] = useState<Sort>('hot')
  const [comments, setComments] = useState<Comment[]>([])
  const [target, setTarget] = useState<LX.Music.MusicInfoOnline | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const version = useRef(0)
  const pending = useRef(false)
  const paging = useRef({ page: 0, max: 1 })
  useEffect(() => { setComponentId(COMPONENT_IDS.comment, componentId) }, [componentId])
  useEffect(() => {
    const request = ++version.current
    pending.current = true
    paging.current = { page: 0, max: 1 }
    setComments([]); setTotal(null); setTarget(null); setError(''); setLoading(true)
    const run = async() => {
      if (!song) throw new Error('尚未选择歌曲')
      const matched = await resolveOfficialTrack(song, source)
      if (request != version.current) return
      setTarget(matched)
      const payload = toOldMusicInfo(matched) as { songmid: string }
      const response = await (sort == 'hot' ? musicSdk[source].comment.getHotComment(payload, 1, 20) : musicSdk[source].comment.getComment(payload, 1, 20)) as OfficialCommentInfo
      if (request != version.current) return
      if (!Array.isArray(response.comments)) throw new Error('平台返回的评论资料不完整')
      paging.current = { page: 1, max: response.maxPage }
      setComments(filterList(response.comments)); setTotal(response.total)
    }
    void run().catch((error: unknown) => { if (request == version.current) setError(error instanceof Error ? error.message : '评论同步失败，请稍后重试') })
      .finally(() => { if (request == version.current) { pending.current = false; setLoading(false); setRefreshing(false) } })
    return () => { version.current = request + 1 }
  }, [song, source, sort, reload])
  const loadMore = async() => {
    if (pending.current || !target || paging.current.page < 1 || paging.current.page >= paging.current.max) return
    const request = version.current
    const page = paging.current.page + 1
    pending.current = true; setLoading(true); setError('')
    try {
      const payload = toOldMusicInfo(target) as { songmid: string }
      const response = await (sort == 'hot' ? musicSdk[source].comment.getHotComment(payload, page, 20) : musicSdk[source].comment.getComment(payload, page, 20)) as OfficialCommentInfo
      if (request != version.current) return
      if (!Array.isArray(response.comments)) throw new Error('平台返回的评论资料不完整')
      paging.current = { page, max: response.maxPage }
      setComments(previous => filterList([...previous, ...response.comments]))
    } catch (error: unknown) { if (request == version.current) setError(error instanceof Error ? error.message : '加载失败') } finally { if (request == version.current) { pending.current = false; setLoading(false) } }
  }
  const refresh = () => { setRefreshing(true); setSong(currentMusic()); setReload(value => value + 1) }
  const platform = source == 'wy' ? '网易云音乐' : 'QQ音乐'
  const cover = song?.meta.picUrl ?? target?.meta.picUrl
  return <PageContent>
    <View style={{ flex: 1, paddingTop: inset, backgroundColor: theme['c-content-background'] }}>
      <StatusBar />
      <View style={{ minHeight: 56, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="返回播放器" onPress={() => { void pop(componentId) }} style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }}><Icon name="chevron-left" size={18} /></TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}><Text size={18}>评论</Text></View>
        <View style={{ width: 48 }} />
      </View>
      <View style={{ marginHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme['c-list-header-border-bottom'] }}>
        <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: '#080809', borderWidth: 1, borderColor: theme['c-list-header-border-bottom'], alignItems: 'center', justifyContent: 'center' }}>
          <Image url={cover} style={{ width: 38, height: 38, borderRadius: 19 }} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text size={16} numberOfLines={1}>{song?.name ?? '歌曲评论'}</Text>
          <Text size={13} color={theme['c-font-label']} numberOfLines={1} style={{ marginTop: 6 }}>{song?.singer ?? '未知歌手'}</Text>
          <Text size={11} color={theme['c-font-label']} numberOfLines={1} style={{ marginTop: 4 }}>{platform}</Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 18, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text size={17}>评论（{total ?? (comments.length ? `${comments.length}+` : 0)}）</Text>
        <InlineOptions value={source} options={OFFICIAL_PLATFORMS} onChange={setSource} size={12} style={{ width: 148, flexShrink: 0 }} />
      </View>
      <View style={{ paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme['c-list-header-border-bottom'] }}>
        {(['hot', 'new'] as const).map(type => <TouchableOpacity key={type} accessibilityRole="tab" accessibilityState={{ selected: sort == type }} onPress={() => { setSort(type) }} style={{ minHeight: 46, marginRight: 26, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: sort == type ? theme['c-font'] : 'transparent' }}><Text size={14} color={sort == type ? theme['c-font'] : theme['c-font-label']}>{type == 'hot' ? '热门' : '最新'}</Text></TouchableOpacity>)}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="刷新评论" onPress={refresh} style={{ marginLeft: 'auto', minHeight: 46, width: 44, justifyContent: 'center', alignItems: 'flex-end' }}><Icon name="available_updates" size={18} /></TouchableOpacity>
      </View>
      {target && target.id != song?.id ? <Text size={12} color={theme['c-font-label']} style={{ paddingHorizontal: 18, paddingTop: 10 }}>匹配歌曲：{target.name} · {target.singer}</Text> : null}
      <FlatList key={`${source}_${sort}_${song?.id}`} data={comments} keyExtractor={item => String(item.id)} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }} renderItem={({ item }) => <CommentFloor comment={item} />}
        onEndReachedThreshold={0.3} onEndReached={() => { if (!error) void loadMore() }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme['c-font']]} />}
        ListEmptyComponent={<Text size={14} color={theme['c-font-label']} style={{ paddingVertical: 32 }}>{loading ? `正在从${platform}同步评论…` : error || '暂无公开评论'}</Text>}
        ListFooterComponent={<View>
          {comments.length && loading ? <Text size={13} style={{ paddingVertical: 16 }}>正在加载…</Text> : null}
          {error ? <TouchableOpacity accessibilityRole="button" onPress={() => { if (comments.length) void loadMore(); else setReload(value => value + 1) }} style={{ minHeight: 48, justifyContent: 'center' }}><Text size={13}>{comments.length ? `${error} · ` : ''}点击重试</Text></TouchableOpacity> : null}
          {target ? <TouchableOpacity accessibilityRole="button" onPress={() => { void Linking.openURL(source == 'wy' ? `https://music.163.com/song?id=${target.meta.songId}` : `https://y.qq.com/n/ryqq/songDetail/${target.meta.songId}`).catch(() => { setError('无法打开官方歌曲页') }) }} style={{ minHeight: 48, justifyContent: 'center' }}><Text size={12} color={theme['c-font-label']}>查看{platform}原页面</Text></TouchableOpacity> : null}
        </View>} />
    </View>
  </PageContent>
}
