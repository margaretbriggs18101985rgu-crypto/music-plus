import { useRef, useEffect } from 'react'
import { type LayoutChangeEvent, View } from 'react-native'

// import music from '@/utils/musicSdk'
// import InsetShadow from 'react-native-inset-shadow'
// import TipList from './components/TipList'
// import MusicList from './components/MusicList'
import HeaderBar, { type HeaderBarProps, type HeaderBarType } from './HeaderBar'
import searchState, { type SearchType } from '@/store/search/state'
import { getSearchSetting, saveSearchSetting } from '@/utils/data'
import { createStyle } from '@/utils/tools'
import TipList, { type TipListType } from './TipList'
import List, { type ListType } from './List'
import { addHistoryWord } from '@/core/search/search'
import SearchTypeSelector from './SearchTypeSelector'
import SourceSelector, { type SourceSelectorType } from '@/components/SourceSelector'
import musicSearchState from '@/store/search/music/state'
import songlistSearchState from '@/store/search/songlist/state'


interface SearchInfo {
  source: LX.OnlineSource | 'all'
  searchType: 'music' | 'songlist'
}

type Sources = ReadonlyArray<SearchInfo['source']>
const getSources = (type: SearchType): Sources => type == 'songlist' ? songlistSearchState.sources : musicSearchState.sources

export default () => {
  const headerBarRef = useRef<HeaderBarType>(null)
  const searchTipListRef = useRef<TipListType>(null)
  const listRef = useRef<ListType>(null)
  const layoutHeightRef = useRef<number>(0)
  const searchInfo = useRef<SearchInfo>({ source: 'kw', searchType: 'music' })
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const sourceSelectorRef = useRef<SourceSelectorType<Sources>>(null)

  useEffect(() => {
    let active = true
    void getSearchSetting().then(info => {
      if (!active) return
      // info.type = 'music'
      const sources = getSources(info.type)
      searchInfo.current.source = sources.includes(info.source) ? info.source : sources[0]
      searchInfo.current.searchType = info.type
      sourceSelectorRef.current?.setSourceList(sources, searchInfo.current.source)
      headerBarRef.current?.setText(searchState.searchText)
      listRef.current?.loadList(searchState.searchText, searchInfo.current.source, searchInfo.current.searchType)
    })

    const handleTypeChange = (type: SearchType) => {
      searchInfo.current.searchType = type
      const sources = getSources(type)
      if (!sources.includes(searchInfo.current.source)) searchInfo.current.source = sources[0]
      sourceSelectorRef.current?.setSourceList(sources, searchInfo.current.source)
      void saveSearchSetting({ type, source: searchInfo.current.source })
      listRef.current?.loadList(searchState.searchText, searchInfo.current.source, type)
    }
    global.app_event.on('searchTypeChanged', handleTypeChange)

    return () => {
      active = false
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      global.app_event.off('searchTypeChanged', handleTypeChange)
    }
  }, [])

  const handleSourceChange = (source: SearchInfo['source']) => {
    searchInfo.current.source = source
    void saveSearchSetting({ source })
    handleHideTipList()
    listRef.current?.loadList(searchState.searchText, source, searchInfo.current.searchType)
  }


  const handleLayout = (e: LayoutChangeEvent) => {
    layoutHeightRef.current = e.nativeEvent.layout.height
  }

  const handleTipSearch: HeaderBarProps['onTipSearch'] = (text) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      searchTipListRef.current?.search(text, layoutHeightRef.current)
    }, 500)
  }
  const handleHideTipList = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    searchTipListRef.current?.hide()
  }
  const handleSearch: HeaderBarProps['onSearch'] = (text) => {
    handleHideTipList()
    searchTipListRef.current?.search(text, layoutHeightRef.current)
    headerBarRef.current?.setText(text)
    headerBarRef.current?.blur()
    void addHistoryWord(text)
    listRef.current?.loadList(text, searchInfo.current.source, searchInfo.current.searchType)
  }
  const handleShowTipList: HeaderBarProps['onShowTipList'] = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      searchTipListRef.current?.show(layoutHeightRef.current)
    }, 500)
  }

  return (
    <View style={styles.container}>
      <HeaderBar
        ref={headerBarRef}
        onTipSearch={handleTipSearch}
        onSearch={handleSearch}
        onHideTipList={handleHideTipList}
        onShowTipList={handleShowTipList}
      />
      <View style={styles.filters}>
        <SearchTypeSelector />
        <SourceSelector ref={sourceSelectorRef} onSourceChange={handleSourceChange} />
      </View>
      <View style={styles.content} onLayout={handleLayout}>
        <TipList ref={searchTipListRef} onSearch={handleSearch} />
        <List ref={listRef} onSearch={handleSearch} />
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    width: '100%',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  filters: {
    marginHorizontal: 18,
    marginBottom: 8,
  },
})
