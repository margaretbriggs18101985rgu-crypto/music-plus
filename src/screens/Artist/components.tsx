import { useState } from 'react'
import { ActivityIndicator, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { LIST_IDS } from '@/config/constant'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { toast } from '@/utils/tools'

export const playSongs = async(list: LX.Music.MusicInfoOnline[], index = 0) => {
  const selected = list[index]
  if (!selected) return
  try {
    await setTempList(`artist__${selected.source}_${selected.id}_${list.length}`, [...list])
    await playList(LIST_IDS.TEMP, index)
  } catch { toast('播放失败，请稍后重试') }
}
export const PlayAll = ({ list, label = '播放热门歌曲', disabled = false, action, subtitle }: { list: LX.Music.MusicInfoOnline[], label?: string, disabled?: boolean, action?: React.ReactElement, subtitle?: string }) => {
  const [pending, setPending] = useState(false)
  const theme = useTheme()
  return <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 16 }}><TouchableOpacity accessibilityRole="button" accessibilityLabel={label} disabled={!list.length || pending || disabled}
    onPress={() => { setPending(true); void playSongs(list).finally(() => { setPending(false) }) }}
    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 84, opacity: list.length && !disabled ? 1 : 0.45 }}>
    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#F13D45', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}><Icon name="play" size={20} color="#FFFFFF" /></View>
    <View style={{ flex: 1 }}><Text size={16} style={{ fontWeight: '600' }}>{pending ? '正在播放…' : label}</Text><Text size={12} color={theme['c-font-label']} style={{ marginTop: 5 }}>{subtitle ?? `${list.length} 首歌曲`}</Text></View>
  </TouchableOpacity>{action}</View>
}
export const SongRow = ({ item, index, list }: { item: LX.Music.MusicInfoOnline, index: number, list: LX.Music.MusicInfoOnline[] }) => {
  const theme = useTheme()
  const playing = usePlayerMusicInfo()
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`播放 ${item.name}，${item.singer}`} onPress={() => { void playSongs(list, index) }}
    style={{ flexDirection: 'row', alignItems: 'center', minHeight: 78, paddingHorizontal: 20, paddingVertical: 8 }}>
    <Text size={13} color={playing.id == item.id ? '#F13D45' : theme['c-font-label']} style={{ width: 25 }}>{index + 1}</Text>
    <Image url={item.meta.picUrl} style={{ width: 52, height: 52, borderRadius: 7, marginRight: 13 }} />
    <View style={{ flex: 1 }}><Text size={15} numberOfLines={1} color={playing.id == item.id ? '#F13D45' : theme['c-font']}>{item.name}</Text>
      <Text size={12} numberOfLines={1} color={theme['c-font-label']} style={{ marginTop: 6 }}>{item.singer}{item.meta.albumName ? ` · ${item.meta.albumName}` : ''}</Text></View>
    <Text size={11} color={theme['c-font-label']} style={{ marginLeft: 12 }}>{item.interval}</Text>
  </TouchableOpacity>
}
export const LoadState = ({ loading, error, empty, retry }: { loading: boolean, error: string, empty: boolean, retry: () => void }) => {
  const theme = useTheme()
  return <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20 }}>
    {loading ? <ActivityIndicator color={theme['c-font-label']} /> : error ? <TouchableOpacity accessibilityRole="button" onPress={retry} style={{ minHeight: 48, justifyContent: 'center' }}><Text size={13} style={{ textAlign: 'center' }}>{error} · 点击重试</Text></TouchableOpacity>
      : empty ? <Text size={13} color={theme['c-font-label']}>暂无公开作品</Text> : null}
  </View>
}
