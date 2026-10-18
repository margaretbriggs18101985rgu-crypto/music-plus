import { useEffect, useState } from 'react'
import commonState, { type InitState } from '@/store/common/state'

const hideKeys: Readonly<Array<keyof LX.AppSetting>> = [
  'list.isShowAlbumName',
  'list.isShowInterval',
  'theme.fontShadow',
]

export const useLazyPage = (id: InitState['navActiveId']) => {
  const [visible, setVisible] = useState(commonState.navActiveId == id)
  useEffect(() => {
    let currentId = commonState.navActiveId
    let frame: number | null = null
    const cancelReveal = () => {
      if (frame != null) cancelAnimationFrame(frame)
      frame = null
    }
    const handleNav = (nextId: InitState['navActiveId']) => {
      currentId = nextId
      if (nextId != id) return
      cancelReveal()
      frame = requestAnimationFrame(() => { frame = null; setVisible(true) })
    }
    const handleHide = () => {
      if (currentId != 'nav_setting' || id == 'nav_setting') return
      cancelReveal()
      setVisible(false)
    }
    const handleConfig = (keys: Array<keyof LX.AppSetting>) => {
      if (keys.some(key => hideKeys.includes(key))) handleHide()
    }
    global.state_event.on('navActiveIdUpdated', handleNav)
    global.state_event.on('themeUpdated', handleHide)
    global.state_event.on('languageChanged', handleHide)
    global.state_event.on('configUpdated', handleConfig)
    return () => {
      cancelReveal()
      global.state_event.off('navActiveIdUpdated', handleNav)
      global.state_event.off('themeUpdated', handleHide)
      global.state_event.off('languageChanged', handleHide)
      global.state_event.off('configUpdated', handleConfig)
    }
  }, [id])
  return visible
}
