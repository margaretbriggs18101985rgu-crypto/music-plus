import Content from './Content'
import PlayerBar from '@/components/player/PlayerBar'
import BottomNav from './BottomNav'
import { useEffect } from 'react'
import { AppState, DeviceEventEmitter, NativeModules } from 'react-native'
import { setNavActiveId } from '@/core/common'
import commonState from '@/store/common/state'
import { pop } from '@/navigation'

interface VinylNavigationBridge { consumeRoute: () => Promise<string | null> }

export default () => {
  useEffect(() => {
    const bridge = NativeModules.LXVinylNavigation as VinylNavigationBridge | undefined
    let mounted = true
    const consume = () => {
      void bridge?.consumeRoute().then(route => {
        if (!mounted || !route) return
        if (route == 'nav_search' || route == 'nav_love' || route == 'nav_setting') setNavActiveId(route)
        const detailId = commonState.componentIds.playDetail
        if (detailId) void pop(detailId)
      })
    }
    const request = DeviceEventEmitter.addListener('LXVinylNavigate', consume)
    const lifecycle = AppState.addEventListener('change', state => { if (state == 'active') consume() })
    consume()
    return () => { mounted = false; request.remove(); lifecycle.remove() }
  }, [])
  return (
    <>
      <Content />
      <PlayerBar isHome />
      <BottomNav />
    </>
  )
}
