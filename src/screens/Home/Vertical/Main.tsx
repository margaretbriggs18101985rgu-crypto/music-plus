import { useCallback, useEffect, useMemo, useRef, type ComponentRef } from 'react'
import { View } from 'react-native'
import Search from '../Views/Search'
import SongList from '../Views/SongList'
import Mylist from '../Views/Mylist'
import Leaderboard from '../Views/Leaderboard'
import Setting from '../Views/Setting'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { createStyle } from '@/utils/tools'
import PagerView, { type PageScrollStateChangedNativeEvent, type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import { setNavActiveId } from '@/core/common'
import settingState from '@/store/setting/state'
import { useLazyPage } from './useLazyPage'

const SearchPage = () => {
  const visible = useLazyPage('nav_search')
  return visible ? <Search /> : null
}

const SongListPage = () => {
  const visible = useLazyPage('nav_songlist')
  return visible ? <SongList /> : null
}

const LeaderboardPage = () => {
  const visible = useLazyPage('nav_top')
  return visible ? <Leaderboard /> : null
}

const MylistPage = () => {
  const visible = useLazyPage('nav_love')
  return visible ? <Mylist /> : null
}

const SettingPage = () => {
  const visible = useLazyPage('nav_setting')
  return visible ? <Setting /> : null
}

const viewMap = {
  nav_search: 0,
  nav_songlist: 1,
  nav_top: 2,
  nav_love: 3,
  nav_setting: 4,
}
const indexMap = [
  'nav_search',
  'nav_songlist',
  'nav_top',
  'nav_love',
  'nav_setting',
] as const

const Main = () => {
  const pagerViewRef = useRef<ComponentRef<typeof PagerView>>(null)
  let activeIndexRef = useRef(viewMap[commonState.navActiveId])
  // const isScrollingRef = useRef(false)
  // const scrollPositionRef = useRef(-1)

  // const handlePageScroll = useCallback(({ nativeEvent }) => {
  //   console.log(nativeEvent.offset, activeIndexRef.current)
  //   // if (activeIndexRef.current == -1) return
  //   // if (nativeEvent.offset == 0) {
  //   //   isScrollingRef.current = false

  //   //   const index = nativeEvent.position
  //   //   if (activeIndexRef.current == index) return
  //   //   activeIndexRef.current = index
  //   //   setNavActiveIndex(index)
  //   // } else if (!isScrollingRef.current) {
  //   //   isScrollingRef.current = true
  //   // }
  // }, [setNavActiveIndex])

  const onPageSelected = useCallback(({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    // console.log(nativeEvent)
    activeIndexRef.current = nativeEvent.position
    if (activeIndexRef.current != viewMap[commonState.navActiveId]) {
      setNavActiveId(indexMap[activeIndexRef.current])
    }
  }, [])

  const onPageScrollStateChanged = useCallback(({ nativeEvent }: PageScrollStateChangedNativeEvent) => {
    // console.log(nativeEvent)
    const idle = nativeEvent.pageScrollState == 'idle'
    if (global.lx.homePagerIdle != idle) global.lx.homePagerIdle = idle
    // if (nativeEvent.pageScrollState != 'idle') return
    // if (scrollPositionRef.current != commonState.navActiveIndex) {
    //   setNavActiveIndex(scrollPositionRef.current)
    // }
    // if (activeIndexRef.current == -1) return
    // if (nativeEvent.offset == 0) {
    //   isScrollingRef.current = false

    //   const index = nativeEvent.position
    //   if (activeIndexRef.current == index) return
    //   activeIndexRef.current = index
    //   setNavActiveIndex(index)
    // } else if (!isScrollingRef.current) {
    //   isScrollingRef.current = true
    // }
  }, [])

  useEffect(() => {
    const handleUpdate = (id: CommonState['navActiveId']) => {
      const index = viewMap[id]
      if (activeIndexRef.current == index) return
      activeIndexRef.current = index
      pagerViewRef.current?.setPage(index)
    }
    const handleConfigUpdate = (keys: Array<keyof LX.AppSetting>, setting: Partial<LX.AppSetting>) => {
      if (!keys.includes('common.homePageScroll')) return
      pagerViewRef.current?.setScrollEnabled(setting['common.homePageScroll']!)
    }
    // window.requestAnimationFrame(() => pagerViewRef.current && pagerViewRef.current.setPage(activeIndexRef.current))
    global.state_event.on('navActiveIdUpdated', handleUpdate)
    global.state_event.on('configUpdated', handleConfigUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleUpdate)
      global.state_event.off('configUpdated', handleConfigUpdate)
    }
  }, [])


  const component = useMemo(() => (
    <PagerView ref={pagerViewRef}
      initialPage={activeIndexRef.current}
      // onPageScroll={handlePageScroll}
      offscreenPageLimit={1}
      onPageSelected={onPageSelected}
      onPageScrollStateChanged={onPageScrollStateChanged}
      scrollEnabled={settingState.setting['common.homePageScroll']}
      style={styles.pagerView}
    >
      <View collapsable={false} key="nav_search" style={styles.pageStyle}>
        <SearchPage />
      </View>
      <View collapsable={false} key="nav_songlist" style={styles.pageStyle}>
        <SongListPage />
      </View>
      <View collapsable={false} key="nav_top" style={styles.pageStyle}>
        <LeaderboardPage />
      </View>
      <View collapsable={false} key="nav_love" style={styles.pageStyle}>
        <MylistPage />
      </View>
      <View collapsable={false} key="nav_setting" style={styles.pageStyle}>
        <SettingPage />
      </View>
      {/* <View collapsable={false} key="nav_search" style={styles.pageStyle}>
        <Search />
      </View>
      <View collapsable={false} key="nav_songlist" style={styles.pageStyle}>
        <SongList />
      </View>
      <View collapsable={false} key="nav_top" style={styles.pageStyle}>
        <Leaderboard />
      </View>
      <View collapsable={false} key="nav_love" style={styles.pageStyle}>
        <Mylist />
      </View>
      <View collapsable={false} key="nav_setting" style={styles.pageStyle}>
        <Setting />
      </View> */}
    </PagerView>
  ), [onPageScrollStateChanged, onPageSelected])

  return component
}

const styles = createStyle({
  pagerView: {
    flex: 1,
    overflow: 'hidden',
  },
  pageStyle: {
    // alignItems: 'center',
    // padding: 20,
  },
})


export default Main

