import { useEffect, useState } from 'react'
import { DeviceEventEmitter, FlatList, Modal, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { usePlayInfo, usePlayMusicInfo } from '@/store/player/hook'
import playerState from '@/store/player/state'
import { getListMusics } from '@/core/list'
import { playQueuedItem, togglePlay } from '@/core/player/player'
import { removeTempPlayList } from '@/core/player/tempPlayList'

const EVENT = 'lx_showPlaybackQueue'
export const showPlaybackQueue = () => { DeviceEventEmitter.emit(EVENT) }
interface QueueRow { key: string, music: LX.Music.MusicInfo, index: number, kind: 'current' | 'later' | 'list', listId: string | null }
const music = (value: LX.Player.PlayMusic) => 'progress' in value ? value.metadata.musicInfo : value

// One host in Home, shared by the mini player and the native detail screen.
export default () => {
  const theme = useTheme()
  const current = usePlayMusicInfo()
  const info = usePlayInfo()
  const mode = useSettingValue('player.togglePlayMethod')
  const [visible, setVisible] = useState(false)
  const [rows, setRows] = useState<QueueRow[]>([])
  useEffect(() => { const listener = DeviceEventEmitter.addListener(EVENT, () => { setVisible(true) }); return () => { listener.remove() } }, [])
  useEffect(() => {
    if (!visible) return
    let active = true
    let request = 0
    const update = () => {
      const id = ++request
      const listId = playerState.playInfo.playerListId
      void (listId ? getListMusics(listId) : Promise.resolve([])).then(list => {
        if (!active || request != id) return
        const state = playerState.playMusicInfo
        const result: QueueRow[] = state.musicInfo ? [{ key: 'current', music: music(state.musicInfo), index: -1, kind: 'current', listId: state.listId }] : []
        playerState.tempPlayList.forEach((item, index) => result.push({ key: `later_${index}`, music: music(item.musicInfo), index, kind: 'later', listId: item.listId }))
        const index = state.isTempPlay ? playerState.playInfo.playerPlayIndex : list.findIndex(item => item.id == state.musicInfo?.id)
        const following = list.map((item, position) => ({ key: `list_${position}`, music: item, index: position, kind: 'list' as const, listId }))
        if (mode == 'random') {
          const played = new Set(playerState.playedList.filter(item => item.listId == listId).map(item => item.musicInfo.id))
          result.push(...following.filter(item => item.music.id != state.musicInfo?.id && !played.has(item.music.id)))
        } else if (mode == 'list' || mode == 'listLoop') {
          result.push(...following.slice(index + 1))
          if (mode == 'listLoop' && index > 0) result.push(...following.slice(0, index))
        }
        setRows(result)
      }).catch(() => { if (active) setRows([]) })
    }
    update()
    global.state_event.on('playTempPlayListChanged', update)
    global.app_event.on('myListMusicUpdate', update)
    return () => { active = false; global.state_event.off('playTempPlayListChanged', update); global.app_event.off('myListMusicUpdate', update) }
  }, [visible, current, info, mode])
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { setVisible(false) }}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}>
      <TouchableOpacity accessibilityLabel="关闭播放队列" style={{ flex: 1 }} onPress={() => { setVisible(false) }} />
      <View style={{ maxHeight: '68%', paddingBottom: 24, backgroundColor: theme['c-content-background'], borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, minHeight: 60 }}>
          <View style={{ flex: 1 }}><Text size={17}>播放队列 · {rows.length}</Text>
            {mode == 'random' ? <Text size={11} color={theme['c-font-label']}>稍后播放优先，其余歌曲随机播放</Text> : null}</View>
          <TouchableOpacity accessibilityRole="button" style={{ minHeight: 48, justifyContent: 'center' }} onPress={() => { setVisible(false) }}><Text size={14}>关闭</Text></TouchableOpacity>
        </View>
        <FlatList data={rows} keyExtractor={item => item.key} ListEmptyComponent={<Text color={theme['c-font-label']} style={{ padding: 24 }}>暂无排队歌曲</Text>}
          renderItem={({ item }) => <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 66 }}>
            <TouchableOpacity style={{ minHeight: 62, paddingLeft: 22, paddingRight: 12, justifyContent: 'center', flex: 1 }}
              onPress={() => { if (item.kind == 'current') togglePlay(); else void playQueuedItem(item.listId, item.index, item.kind == 'later'); setVisible(false) }}>
              <Text size={15} numberOfLines={1}>{item.kind == 'current' ? '正在播放 · ' : item.kind == 'later' ? '稍后播放 · ' : ''}{item.music.name}</Text>
              <Text size={12} color={theme['c-font-label']} numberOfLines={1} style={{ marginTop: 4 }}>{item.music.singer || '未知歌手'}</Text>
            </TouchableOpacity>
            {item.kind == 'later' ? <TouchableOpacity accessibilityLabel={`移出队列 ${item.music.name}`} style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }} onPress={() => { removeTempPlayList(item.index) }}><Icon name="close" size={14} /></TouchableOpacity> : null}
          </View>} />
      </View>
    </View>
  </Modal>
}
