import { useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import Input from '@/components/common/Input'
import CheckBox from '@/components/common/CheckBox'
import { cancelTimeoutExit, startTimeoutExit, stopTimeoutExit, useTimeoutExitTimeInfo } from '@/core/player/timeoutExit'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { formatPlayTime2 } from '@/utils/common'
import { toast } from '@/utils/tools'

export default () => {
  const saved = useSettingValue('player.timeoutExit')
  const finishSong = useSettingValue('player.timeoutExitPlayed')
  const [minutes, setMinutes] = useState(saved || '30')
  const info = useTimeoutExitTimeInfo()
  const active = info.time >= 0 || info.isPlayedStop
  const start = () => {
    const value = Number(minutes.trim())
    if (!/^\d+$/.test(minutes.trim()) || value < 1 || value > 1440) { toast('请输入 1～1440 分钟'); return }
    cancelTimeoutExit()
    startTimeoutExit(value * 60)
    updateSetting({ 'player.timeoutExit': String(value) })
  }
  const cancel = () => { stopTimeoutExit(); cancelTimeoutExit() }
  return <View style={styles.content}>
    <Text size={24} style={styles.title}>睡眠定时</Text>
    <Text size={14} color="#9A9A9F" style={styles.status}>{info.isPlayedStop ? '当前歌曲结束后停止' : info.time >= 0 ? `剩余 ${formatPlayTime2(info.time)}` : '选择时长，到时停止播放'}</Text>
    <View style={styles.presets}>{[15, 30, 45, 60, 90].map(value => <TouchableOpacity key={value} accessibilityRole="radio"
      accessibilityLabel={`${value} 分钟`} accessibilityState={{ checked: minutes == String(value) }}
      onPress={() => { setMinutes(String(value)) }} style={[styles.preset, minutes == String(value) && styles.selected]}>
      <Text size={15}>{value} 分钟</Text>
    </TouchableOpacity>)}</View>
    <View style={styles.inputRow}><Text size={16}>自定义</Text><Input accessibilityLabel="睡眠定时分钟数" value={minutes}
      onChangeText={setMinutes} keyboardType="number-pad" maxLength={4} style={styles.input} /><Text size={15} color="#9A9A9F">分钟</Text></View>
    <CheckBox check={finishSong} label="到时播完当前歌曲再停止" onChange={value => { updateSetting({ 'player.timeoutExitPlayed': value }) }} />
    <TouchableOpacity accessibilityRole="button" onPress={start} style={styles.start}><Text color="#FFFFFF" size={16}>{active ? '更新定时' : '开始计时'}</Text></TouchableOpacity>
    {active ? <TouchableOpacity accessibilityRole="button" onPress={cancel} style={styles.cancel}><Text color="#B8B8BE" size={16}>取消定时</Text></TouchableOpacity> : null}
  </View>
}
const styles = StyleSheet.create({
  content: { padding: 24 },
  title: { fontWeight: '600' },
  status: { marginTop: 12, marginBottom: 24 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  preset: { minHeight: 44, paddingHorizontal: 16, borderWidth: 1, borderColor: '#424247', borderRadius: 22, justifyContent: 'center' },
  selected: { backgroundColor: '#513235', borderColor: '#FF5B64' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 },
  input: { backgroundColor: '#2B2B30', borderRadius: 8, minWidth: 90, textAlign: 'center', height: 44 },
  start: { backgroundColor: '#EA3C48', minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
})
