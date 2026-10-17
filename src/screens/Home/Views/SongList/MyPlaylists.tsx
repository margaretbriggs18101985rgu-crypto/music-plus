import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, DeviceEventEmitter, FlatList, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { LIST_IDS } from '@/config/constant'
import { useMyList } from '@/store/list/hook'
import { getListMusics, setActiveList } from '@/core/list'
import { setNavActiveId } from '@/core/common'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import ListImportExport, { type ListImportExportType } from '../Mylist/MyList/ListImportExport'
import ListNameEdit, { type ListNameEditType } from '../Mylist/MyList/ListNameEdit'
import ListMenu, { type ListMenuType } from '../Mylist/MyList/ListMenu'
import ListMusicSort, { type ListMusicSortType } from '../Mylist/MyList/ListMusicSort'
import DuplicateMusic, { type DuplicateMusicType } from '../Mylist/MyList/DuplicateMusic'
import { handleRemove, handleSync } from '../Mylist/MyList/listAction'
import ImportPlaylist from './ImportPlaylist'
import { downloader, getPlaylistCovers, LIBRARY_EVENT, OPEN_LIBRARY, setPlaylistCover } from '@/core/music/library'
import { animateLayoutChange } from '@/components/common/InlineOptions'

export default ({ filter = 'all', onOpen, header }: { filter?: 'all' | 'created' | 'collected', onOpen?: (id: string) => void, header?: React.ReactElement }) => {
  const all = useMyList()
  const lists = useMemo(() => all.filter(item => item.id != LIST_IDS.DEFAULT && (filter != 'collected' || ('source' in item && item.source))), [all, filter])
  const theme = useTheme()
  const files = useRef<ListImportExportType>(null)
  const names = useRef<ListNameEditType>(null)
  const menu = useRef<ListMenuType>(null)
  const sort = useRef<ListMusicSortType>(null)
  const duplicate = useRef<DuplicateMusicType>(null)
  const [details, setDetails] = useState<Record<string, { count: number, pic?: string }>>({})
  const [covers, setCovers] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [editingCover, setEditingCover] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    const update = () => {
      void Promise.all(lists.map(async item => {
        const songs = await getListMusics(item.id)
        return [item.id, { count: songs.length, pic: songs[0]?.meta.picUrl ?? undefined }] as const
      })).then(items => { if (active) setDetails(Object.fromEntries(items)) }).catch(() => {})
      void getPlaylistCovers().then(data => { if (active) setCovers(data) }).catch(() => {})
    }
    update()
    global.app_event.on('myListMusicUpdate', update)
    const listener = DeviceEventEmitter.addListener(LIBRARY_EVENT, update)
    return () => { active = false; listener.remove(); global.app_event.off('myListMusicUpdate', update) }
  }, [lists])
  const changeCover = (item: LX.List.MyListInfo) => {
    animateLayoutChange(); setEditingCover(item.id)
  }
  const actions = <View style={styles.actions}>
    <Text size={12} color={theme['c-font-label']} style={{ flex: 1 }}>{filter == 'collected' ? '收藏与导入的歌单' : '我的歌单'}</Text>
    <TouchableOpacity accessibilityRole="button" onPress={() => { setImporting(true) }} style={styles.action}><Text size={13}>导入歌单</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" onPress={() => names.current?.showCreate(all.length - 2)} style={styles.action}><Text size={13}>新建</Text></TouchableOpacity>
  </View>
  return <View style={{ flex: 1 }}>
    <FlatList data={lists} keyExtractor={item => item.id} ListHeaderComponent={<>{header}{actions}</>} ListEmptyComponent={<Text size={13} color={theme['c-font-label']} style={{ padding: 24 }}>还没有歌单，可以新建或导入歌单链接</Text>} contentContainerStyle={{ paddingBottom: 20 }} renderItem={({ item }) => (
      <View><View style={styles.row}>
        <TouchableOpacity style={styles.list} accessibilityRole="button" accessibilityLabel={`打开歌单 ${item.name}`}
          onPress={() => { setActiveList(item.id); if (onOpen) onOpen(item.id); else { setNavActiveId('nav_love'); DeviceEventEmitter.emit(OPEN_LIBRARY, item.id) } }}>
          <Image url={covers[item.id] ?? details[item.id]?.pic} style={styles.cover} />
          <View style={{ flex: 1, paddingLeft: 12 }}>
            <Text size={16} numberOfLines={1}>{item.name}</Text>
            <Text size={12} numberOfLines={1} color={theme['c-font-label']} style={{ marginTop: 6 }}>{details[item.id] ? `${details[item.id].count} 首` : '读取中…'}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.more} accessibilityRole="button" accessibilityLabel={`管理歌单 ${item.name}`}
          onPress={event => menu.current?.show({ listInfo: item, index: all.findIndex(list => list.id == item.id) }, { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, w: 0, h: 0 })}>
          <Icon name="dots-vertical" size={17} />
        </TouchableOpacity>
      </View>
      {editingCover == item.id ? <View style={{ flexDirection: 'row', paddingHorizontal: 18, backgroundColor: theme['c-primary-input-background'] }}>
        <TouchableOpacity style={styles.action} onPress={() => { void downloader.chooseCover().then(async uri => { if (uri) { await setPlaylistCover(item.id, uri); setEditingCover(null) } }).catch(() => { Alert.alert('无法更换封面', '请重新选择一张可读取的图片') }) }}><Text size={13}>选择图片</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => { void setPlaylistCover(item.id).then(() => { setEditingCover(null) }).catch(() => {}) }}><Text size={13}>恢复默认封面</Text></TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => { animateLayoutChange(); setEditingCover(null) }}><Text size={13}>完成</Text></TouchableOpacity>
      </View> : null}</View>
    )} />
    <ListImportExport ref={files} /><ListNameEdit ref={names} /><ListMusicSort ref={sort} /><DuplicateMusic ref={duplicate} />
    <ImportPlaylist visible={importing} onClose={() => { setImporting(false) }} />
    <ListMenu ref={menu} onNew={position => names.current?.showCreate(position)} onRename={item => names.current?.show(item)}
      onCover={changeCover}
      onSort={item => sort.current?.show(item)} onDuplicateMusic={item => duplicate.current?.show(item)}
      onImport={(item, position) => files.current?.import(item, position)} onExport={(item, position) => files.current?.export(item, position)}
      onRemove={handleRemove} onSync={handleSync} onSelectLocalFile={(item, position) => files.current?.selectFile(item, position)} />
  </View>
}
const styles = createStyle({
  actions: { paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', minHeight: 54 },
  action: { minHeight: 48, paddingHorizontal: 10, justifyContent: 'center' },
  row: { flexDirection: 'row', minHeight: 82, paddingLeft: 18, paddingVertical: 8 },
  list: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  cover: { width: 60, height: 60, borderRadius: 4 },
  more: { width: 48, minHeight: 60, justifyContent: 'center', alignItems: 'center' },
})
