import { getSongListSetting, saveSongListSetting } from '@/utils/data'
import { useEffect, useRef, useState } from 'react'
import { AppState, DeviceEventEmitter, StyleSheet, View } from 'react-native'
import commonState from '@/store/common/state'

// import List from './List/List'
import HeaderBar, { type HeaderBarProps, type HeaderBarType } from './HeaderBar'
import songlistState, { type InitState, type SortInfo } from '@/store/songlist/state'
import List, { type ListType } from './List'
import TagList from './TagList'
import { animateLayoutChange } from '@/components/common/InlineOptions'


interface SonglistInfo {
  source: InitState['sources'][number]
  sortId: SortInfo['id']
  tagId: string
}

export default () => {
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    const show = () => { animateLayoutChange(); setExpanded(value => !value) }
    const hide = () => { animateLayoutChange(); setExpanded(false) }
    global.app_event.on('showSonglistTagList', show)
    global.app_event.on('hideSonglistTagList', hide)
    return () => { global.app_event.off('showSonglistTagList', show); global.app_event.off('hideSonglistTagList', hide) }
  }, [])
  const headerBarRef = useRef<HeaderBarType>(null)
  const listRef = useRef<ListType>(null)
  const songlistInfo = useRef<SonglistInfo>({ source: 'wy', sortId: 'hot', tagId: '' })
  const lastRefresh = useRef(0)

  useEffect(() => {
    let active = true
    void getSongListSetting().then(info => {
      if (!active) return
      songlistInfo.current.source = info.source
      songlistInfo.current.sortId = info.sortId
      songlistInfo.current.tagId = info.tagId
      headerBarRef.current?.setSource(info.source, info.sortId, info.tagName, info.tagId)
      listRef.current?.loadList(info.source, info.sortId, info.tagId, true)
      lastRefresh.current = Date.now()
    })
    const refresh = () => {
      if (commonState.navActiveId != 'nav_songlist' || AppState.currentState != 'active' || Date.now() - lastRefresh.current < 300_000) return
      const info = songlistInfo.current
      listRef.current?.loadList(info.source, info.sortId, info.tagId, true)
      lastRefresh.current = Date.now()
    }
    const nav = (id: string) => { if (id == 'nav_songlist') refresh() }
    global.state_event.on('navActiveIdUpdated', nav)
    const app = AppState.addEventListener('change', state => { if (state == 'active') refresh() })
    const timer = setInterval(refresh, 300_000)
    return () => { active = false; clearInterval(timer); app.remove(); global.state_event.off('navActiveIdUpdated', nav) }
  }, [])

  const handleSortChange: HeaderBarProps['onSortChange'] = (id) => {
    songlistInfo.current.sortId = id
    void saveSongListSetting({ sortId: id })
    listRef.current?.loadList(songlistInfo.current.source, id, songlistInfo.current.tagId)
  }

  const handleTagChange: HeaderBarProps['onTagChange'] = (name, id) => {
    songlistInfo.current.tagId = id
    void saveSongListSetting({ tagName: name, tagId: id })
    listRef.current?.loadList(songlistInfo.current.source, songlistInfo.current.sortId, id)
  }

  const handleSourceChange: HeaderBarProps['onSourceChange'] = (source) => {
    animateLayoutChange(); setExpanded(false)
    songlistInfo.current.source = source
    songlistInfo.current.tagId = ''
    songlistInfo.current.sortId = songlistState.sortList[source]![0].id
    void saveSongListSetting({ sortId: songlistInfo.current.sortId, source, tagId: '', tagName: '' }).then(() => { DeviceEventEmitter.emit('lx_discoveryPlatformChanged') })
    headerBarRef.current?.setSource(source, songlistInfo.current.sortId, '', songlistInfo.current.tagId)
    listRef.current?.loadList(source, songlistInfo.current.sortId, songlistInfo.current.tagId, true)
    lastRefresh.current = Date.now()
  }

  return (
    <View style={styles.container}>
      <HeaderBar
        ref={headerBarRef}
        expanded={expanded}
        onSortChange={handleSortChange}
        onTagChange={handleTagChange}
        onSourceChange={handleSourceChange}
      />
      <View style={{ height: expanded ? 240 : 0, overflow: 'hidden' }}><TagList /></View>
      <List ref={listRef} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flex: 1,
  },
})

