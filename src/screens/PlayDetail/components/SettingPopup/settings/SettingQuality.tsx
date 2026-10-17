import { useState } from 'react'
import { ActivityIndicator, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { usePlayMusicInfo } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { switchCurrentQuality } from '@/core/player/quality'

const qualities = [{ id: '128k', label: '标准', detail: '128 kbps' }, { id: '320k', label: '高品质', detail: '320 kbps' },
  { id: 'flac', label: '无损', detail: 'FLAC' }, { id: 'flac24bit', label: '高解析无损', detail: '24-bit FLAC' }] as const
export default () => {
  const current = usePlayMusicInfo().musicInfo
  const music = current && ('progress' in current ? current.metadata.musicInfo : current)
  const selected = useSettingValue('player.playQuality')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const local = music?.source == 'local'
  const supported = music && music.source != 'local' ? music.meta.qualitys.map(item => item.type) : []
  const options = qualities.filter(item => !music || supported.includes(item.id) || (!supported.length && item.id == '128k'))
  const select = async(quality: LX.Quality) => {
    setLoading(true); setError('')
    try { await switchCurrentQuality(quality) } catch (error) { setError(error instanceof Error ? error.message : '音质切换失败，请重试') } finally { setLoading(false) }
  }
  return <View style={{ padding: 16 }}>
    <Text size={14} color="#96969D" style={{ marginBottom: 20 }}>{local ? '本地音乐保持原文件音质' : '切换音质后从当前进度继续，实际可用音质由音源提供。'}</Text>
    {!local ? options.map(item => <TouchableOpacity key={item.id} accessibilityRole="radio" accessibilityLabel={`${item.label} ${item.detail}`}
      accessibilityState={{ checked: selected == item.id, disabled: loading }} disabled={loading} onPress={() => { void select(item.id) }}
      style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#36363B' }}>
      <Text size={17} style={{ flex: 1 }}>{item.label}</Text><Text size={13} color="#94949B">{item.detail}</Text>
      <Icon name={selected == item.id ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={selected == item.id ? '#FF5963' : '#74747B'} style={{ marginLeft: 16 }} />
    </TouchableOpacity>) : null}
    {loading ? <ActivityIndicator color="#FF5963" style={{ marginTop: 24 }} /> : null}
    {error ? <Text accessibilityRole="alert" size={14} color="#FF8C94" style={{ marginTop: 20 }}>{error}</Text> : null}
  </View>
}
