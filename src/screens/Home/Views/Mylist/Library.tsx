import { useEffect, useState } from 'react'
import { Alert, BackHandler, DeviceEventEmitter, FlatList, ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useMyList } from '@/store/list/hook'
import { setActiveList } from '@/core/list'
import commonState from '@/store/common/state'
import { downloader, getDownloadJobs, getRecentTracks, LIBRARY_EVENT, OPEN_LIBRARY, playLibraryMusic, type DownloadJob, type DownloadStatus, type RecentTrack } from '@/core/music/library'
import MyPlaylists from '../SongList/MyPlaylists'
import MusicBrowser from './MusicBrowser'
import SceneTransition from '@/components/common/SceneTransition'
import { consumeLibraryRoute, LIBRARY_ROUTE_EVENT } from './libraryRoute'

type Page = 'home' | 'playlist' | 'recent' | 'downloads'
interface DownloadItem { job: DownloadJob, state?: DownloadStatus, error?: string }
export default () => {
  const theme = useTheme()
  const t = useI18n()
  const lists = useMyList()
  const [page, setPage] = useState<Page>('home')
  const [tab, setTab] = useState<'created' | 'collected'>('created')
  const [recent, setRecent] = useState<RecentTrack[]>([])
  const [downloads, setDownloads] = useState<DownloadItem[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    const listener = DeviceEventEmitter.addListener(OPEN_LIBRARY, (id: string) => { setActiveList(id); setPage('playlist') })
    return () => { listener.remove() }
  }, [])
  useEffect(() => {
    const openRequestedPage = () => {
      const route = consumeLibraryRoute()
      if (route == 'recent') setPage('recent')
    }
    const listener = DeviceEventEmitter.addListener(LIBRARY_ROUTE_EVENT, openRequestedPage)
    openRequestedPage()
    return () => { listener.remove() }
  }, [])
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (commonState.navActiveId == 'nav_love' && page != 'home') { setPage('home'); return true }
      return false
    })
    return () => { back.remove() }
  }, [page])
  useEffect(() => {
    let active = true
    const loading = { current: false }
    const load = async() => {
      if (loading.current) return
      loading.current = true
      try {
        const [history, jobs] = await Promise.all([getRecentTracks(), getDownloadJobs()])
        const data = await Promise.all(jobs.map(async job => {
          try { return { job, state: await downloader.query(job.id) } } catch (error: unknown) { return { job, error: error instanceof Error ? error.message : '文件不可访问' } }
        }))
        if (active) { setRecent(history); setDownloads(data); setError('') }
      } catch { if (active) setError('音乐库读取失败，请稍后重试') } finally { loading.current = false }
    }
    void load()
    const listener = DeviceEventEmitter.addListener(LIBRARY_EVENT, () => { void load() })
    const nav = (id: string) => { if (id == 'nav_love') void load() }
    global.state_event.on('navActiveIdUpdated', nav)
    const timer = setInterval(() => { if (commonState.navActiveId == 'nav_love') void load() }, 3000)
    return () => { active = false; clearInterval(timer); listener.remove(); global.state_event.off('navActiveIdUpdated', nav) }
  }, [])
  const open = (id: string) => { setActiveList(id); setPage('playlist') }
  const play = (music: LX.Music.MusicInfo) => { void playLibraryMusic(music).catch(() => { Alert.alert('播放失败', '请检查歌曲文件或音源') }) }
  const playDownload = (item: DownloadItem) => {
    if (item.state?.status != 8 || !item.state.uri) return
    const original = item.job.music
    const local: LX.Music.MusicInfoLocal = { id: `download_${item.job.id}`, name: original?.name ?? item.job.title, singer: original?.singer ?? '', interval: original?.interval ?? null, source: 'local', meta: { songId: String(item.job.id), picUrl: original?.meta.picUrl, albumName: original?.meta.albumName ?? '', filePath: item.state.uri, ext: item.job.filename.split('.').pop() ?? 'mp3' } }
    play(local)
  }
  const button = (label: string, action: () => void) => <TouchableOpacity accessibilityRole="button" onPress={action} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 18 }}><Text size={15}>{label}</Text></TouchableOpacity>
  const sectionTabs = <View style={{ flexDirection: 'row', paddingHorizontal: 18, gap: 24, marginTop: 24 }}>
    {(['created', 'collected'] as const).map(type => <TouchableOpacity key={type} accessibilityRole="tab" accessibilityState={{ selected: tab == type }} onPress={() => { setTab(type) }} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text size={19} color={tab == type ? theme['c-font'] : theme['c-font-label']}>{type == 'created' ? '我的歌单' : '收藏歌单'} <Text size={12}>{lists.filter(item => item.id != 'default' && (type != 'collected' || ('source' in item && item.source))).length}</Text></Text>
    </TouchableOpacity>)}
  </View>
  const header = <View>
    <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 20 }}>
      {[{ label: '我的歌单', action: () => { setTab('created') } }, { label: '已下载歌曲', action: () => { setPage('downloads') } }, { label: '收藏歌单', action: () => { setTab('collected') } }, { label: '最近播放', action: () => { setPage('recent') } }].map(item => <TouchableOpacity key={item.label} accessibilityRole="button" onPress={item.action} style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}><Text size={13}>{item.label}</Text></TouchableOpacity>)}
    </View>
    <View style={{ paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}><Text size={19} style={{ flex: 1 }}>最近播放</Text>{button('全部', () => { setPage('recent') })}</View>
    {recent.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 14, paddingTop: 10 }}>
      {recent.slice(0, 8).map(item => <TouchableOpacity key={item.music.id} accessibilityRole="button" accessibilityLabel={`播放最近歌曲 ${item.music.name}`} onPress={() => { play(item.music) }} style={{ width: 118 }}>
        <Image url={item.music.meta.picUrl} style={{ width: 118, height: 118, borderRadius: 7 }} />
        <Text size={14} numberOfLines={1} style={{ marginTop: 10 }}>{item.music.name}</Text><Text size={12} numberOfLines={1} color={theme['c-font-label']} style={{ marginTop: 5 }}>{item.music.singer}</Text>
        {item.playCount != null ? <Text size={10} numberOfLines={1} color={theme['c-font-label']} style={{ marginTop: 4 }}>{t('ui_recent_play_count', { count: item.playCount })}</Text> : null}
      </TouchableOpacity>)}
    </ScrollView> : <Text size={13} color={theme['c-font-label']} style={{ padding: 18 }}>播放歌曲后会记录在这里</Text>}
    {sectionTabs}
    {error ? <Text size={13} style={{ padding: 18 }}>{error}</Text> : null}
  </View>
  return <View style={{ flex: 1 }}>
    <SceneTransition sceneKey={page} direction={page == 'home' ? 'horizontal-reverse' : 'horizontal'}>
    {page == 'home' ? <MyPlaylists filter={tab} onOpen={open} header={header} /> : <>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>{button('返回我的', () => { setPage('home') })}<Text size={16}>{page == 'recent' ? `最近播放 · ${recent.length}` : page == 'downloads' ? `已下载歌曲 · ${downloads.filter(item => item.state?.status == 8).length}` : ''}</Text></View>
      {page == 'playlist' ? <MusicBrowser /> : page == 'recent' ? <FlatList data={recent} keyExtractor={item => item.music.id} ListEmptyComponent={<Text style={{ padding: 24 }} color={theme['c-font-label']}>还没有播放记录</Text>}
        renderItem={({ item }) => <TouchableOpacity accessibilityRole="button" onPress={() => { play(item.music) }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 9 }}>
          <Image url={item.music.meta.picUrl} style={{ width: 52, height: 52, borderRadius: 4 }} /><View style={{ flex: 1, paddingHorizontal: 12 }}><Text size={16} numberOfLines={1}>{item.music.name}</Text><Text size={12} color={theme['c-font-label']} numberOfLines={1} style={{ marginTop: 6 }}>{item.music.singer}</Text>{item.playCount != null ? <Text size={10} color={theme['c-font-label']} numberOfLines={1} style={{ marginTop: 4 }}>{t('ui_recent_track_stats', { plays: item.playCount, completed: item.completedCount ?? 0, minutes: Math.floor((item.listenedSeconds ?? 0) / 60) })}</Text> : null}</View><Icon name="play" size={16} />
        </TouchableOpacity>} /> : <FlatList data={downloads} keyExtractor={item => String(item.job.id)} ListEmptyComponent={<Text style={{ padding: 24 }} color={theme['c-font-label']}>下载的歌曲会显示在这里</Text>}
        renderItem={({ item }) => <TouchableOpacity accessibilityRole="button" disabled={item.state?.status != 8} onPress={() => { playDownload(item) }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10 }}>
          <Image url={item.job.music?.meta.picUrl} style={{ width: 52, height: 52, borderRadius: 4 }} /><View style={{ flex: 1, paddingLeft: 12 }}><Text size={16} numberOfLines={1}>{item.job.title}</Text><Text size={12} color={theme['c-font-label']} numberOfLines={2} style={{ marginTop: 6 }}>{item.error ?? (item.state?.status == 8 ? `已下载 · ${item.job.folderName}` : item.state?.status == 16 ? '下载失败' : '下载中…')}</Text></View>{item.state?.status == 8 ? <Icon name="play" size={16} /> : null}
        </TouchableOpacity>} />}
    </>}
    </SceneTransition>
  </View>
}
