import { useRef, useEffect, useState } from 'react'
import { type LayoutChangeEvent, ScrollView, View } from 'react-native'

// import music from '@/utils/musicSdk'
// import InsetShadow from 'react-native-inset-shadow'
// import TipList from './components/TipList'
// import MusicList from './components/MusicList'
import HeaderBar, { type HeaderBarProps, type HeaderBarType } from './HeaderBar'
import searchState from '@/store/search/state'
import { saveSearchSetting } from '@/utils/data'
import { createStyle } from '@/utils/tools'
import TipList, { type TipListType } from './TipList'
import List, { type ListType } from './List'
import { addHistoryWord, setSearchText } from '@/core/search/search'
import { useSettingValue } from '@/store/setting/hook'
import HistorySearch from './BlankView/HistorySearch'

export default () => {
  const headerBarRef = useRef<HeaderBarType>(null)
  const searchTipListRef = useRef<TipListType>(null)
  const listRef = useRef<ListType>(null)
  const layoutHeightRef = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const isShowHistorySearch = useSettingValue('search.isShowHistorySearch')

  useEffect(() => {
    void saveSearchSetting({ source: 'all' })
    headerBarRef.current?.setText(searchState.searchText)
    listRef.current?.loadList(searchState.searchText, 'all', 'music')

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleLayout = (e: LayoutChangeEvent) => {
    layoutHeightRef.current = e.nativeEvent.layout.height
  }

  const handleTipSearch: HeaderBarProps['onTipSearch'] = (text) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    searchTipListRef.current?.hide()
    setSearchText(text)
    if (!text) return
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
    text = text.trim()
    setSearchText(text)
    headerBarRef.current?.setText(text)
    setSearchFocused(!text)
    if (text) headerBarRef.current?.blur()
    void addHistoryWord(text)
    listRef.current?.loadList(text, 'all', 'music')
  }
  const handleShowTipList: HeaderBarProps['onShowTipList'] = () => {
    handleHideTipList()
    setSearchFocused(true)
  }
  const handleBlur = () => {
    handleHideTipList()
    setSearchFocused(false)
  }

  return (
    <View style={styles.container}>
      <HeaderBar
        ref={headerBarRef}
        onTipSearch={handleTipSearch}
        onSearch={handleSearch}
        onHideTipList={handleBlur}
        onShowTipList={handleShowTipList}
      />
      <View style={styles.content} onLayout={handleLayout}>
        <TipList ref={searchTipListRef} onSearch={handleSearch} />
        {searchFocused && isShowHistorySearch ? (
          <ScrollView
            style={styles.history}
            contentContainerStyle={styles.historyContent}
            keyboardShouldPersistTaps="handled"
          >
            <HistorySearch onSearch={handleSearch} />
          </ScrollView>
        ) : null}
        <View style={styles.content}>
          <List ref={listRef} onSearch={handleSearch} />
        </View>
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
  history: {
    flexGrow: 0,
    maxHeight: '60%',
  },
  historyContent: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
})
