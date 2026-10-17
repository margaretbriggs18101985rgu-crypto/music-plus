import { useState } from 'react'
import { View, TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import Content from './Content'
import MyPlaylists from './MyPlaylists'
import { useTheme } from '@/store/theme/hook'
import SceneTransition from '@/components/common/SceneTransition'
export default () => {
  const [tab, setTab] = useState(0)
  const theme = useTheme()
  return <View style={{ flex: 1 }}>
    <View style={{ flexDirection: 'row', paddingHorizontal: 18, gap: 26 }}>
      {['发现歌单', '我的歌单'].map((label, index) => <TouchableOpacity key={label} accessibilityRole="tab" accessibilityState={{ selected: tab == index }} onPress={() => { setTab(index) }} style={{ minHeight: 48, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: tab == index ? theme['c-font'] : 'transparent' }}><Text size={16} color={tab == index ? theme['c-font'] : theme['c-font-label']}>{label}</Text></TouchableOpacity>)}
    </View>
    <SceneTransition sceneKey={String(tab)} direction="fade">
      {tab == 0 ? <View style={{ flex: 1 }}><Content /></View> : <MyPlaylists />}
    </SceneTransition>
  </View>
}
