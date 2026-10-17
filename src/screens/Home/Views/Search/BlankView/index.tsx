import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import HistorySearch, { type HistorySearchType } from './HistorySearch'
import HotSearch, { type HotSearchType } from './HotSearch'
import ListeningHome from './ListeningHome'

interface BlankViewProps {
  onSearch: (keyword: string) => void
}
type Source = LX.OnlineSource | 'all'

export interface BlankViewType {
  show: (source: Source) => void
}

export default forwardRef<BlankViewType, BlankViewProps>(({ onSearch }, ref) => {
  // const [listType, setListType] = useState<SearchState['searchType']>('music')
  const [visible, setVisible] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const refreshKeyRef = useRef(0)
  const completedRefreshParts = useRef(new Set<string>())
  const hotSearchRef = useRef<HotSearchType>(null)
  const historySearchRef = useRef<HistorySearchType>(null)
  const isShowHotSearch = useSettingValue('search.isShowHotSearch')
  const isShowHistorySearch = useSettingValue('search.isShowHistorySearch')
  const onRefresh = useCallback(() => {
    const key = refreshKeyRef.current + 1
    refreshKeyRef.current = key
    completedRefreshParts.current.clear()
    setRefreshing(true)
    setRefreshKey(key)
  }, [])
  const onRefreshComplete = useCallback((key: number, part: string) => {
    if (key != refreshKeyRef.current) return
    completedRefreshParts.current.add(part)
    if (completedRefreshParts.current.has('catalog') && completedRefreshParts.current.has('songs')) setRefreshing(false)
  }, [])

  const handleShow = (source: Source) => {
    hotSearchRef.current?.show(source)
    historySearchRef.current?.show()
  }

  useImperativeHandle(ref, () => ({
    show(source) {
      if (visible) handleShow(source)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          handleShow(source)
        })
      }
    },
  }), [visible])

  return (
    visible
      ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
              <View style={styles.content}>
                <ListeningHome refreshKey={refreshKey} onRefreshComplete={onRefreshComplete} />
                { isShowHotSearch ? <HotSearch ref={hotSearchRef} onSearch={onSearch} /> : null }
                { isShowHistorySearch ? <HistorySearch ref={historySearchRef} onSearch={onSearch} /> : null }
              </View>
            </ScrollView>
        )
      : null

  )
})


const styles = createStyle({
  content: {
    // paddingTop: 15,
    paddingBottom: 15,
    paddingLeft: 18,
    paddingRight: 18,
  },
})
