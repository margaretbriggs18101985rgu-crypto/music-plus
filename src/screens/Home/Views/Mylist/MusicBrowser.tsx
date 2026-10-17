import { useEffect, useState } from 'react'
import { View } from 'react-native'
import MusicList from './MusicList'
import MyList from './MyList'
import { animateLayoutChange } from '@/components/common/InlineOptions'
export default () => {
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    const change = (visible: boolean) => { animateLayoutChange(); setExpanded(value => visible ? !value : false) }
    global.app_event.on('changeLoveListVisible', change)
    return () => { global.app_event.off('changeLoveListVisible', change) }
  }, [])
  return <View style={{ flex: 1 }}>
    <View style={{ height: expanded ? 240 : 0, overflow: 'hidden' }}><MyList /></View>
    <MusicList />
  </View>
}
