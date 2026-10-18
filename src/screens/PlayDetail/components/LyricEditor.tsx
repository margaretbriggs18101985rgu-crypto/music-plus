import { useEffect, useRef, useState } from 'react'
import { TextInput, View } from 'react-native'
import Text from '@/components/common/Text'
import Button from '@/screens/Home/Views/Setting/components/Button'
import { useTheme } from '@/store/theme/hook'
import { usePlayMusicInfo } from '@/store/player/hook'
import playerState from '@/store/player/state'
import { getPlayerLyric } from '@/utils/data'
import { MAX_LYRIC_LENGTH, resetCurrentEditedLyric, saveCurrentEditedLyric } from '@/core/lyricEditor'

export default () => {
  const theme = useTheme()
  const current = usePlayMusicInfo()
  const [track] = useState(() => {
    const value = playerState.playMusicInfo.musicInfo
    return value && !('progress' in value) ? value : null
  })
  const [info, setInfo] = useState({ lyric: '', tlyric: '', rlyric: '' })
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('')
  const mounted = useRef(true)
  const changed = !track || current.musicInfo?.id != track.id
  useEffect(() => {
    mounted.current = true
    if (!track) { setBusy(false); return }
    void getPlayerLyric(track).then(value => {
      if (!mounted.current || playerState.playMusicInfo.musicInfo?.id != track.id) return
      setInfo({ lyric: value.lyric.length ? value.lyric : playerState.musicInfo.lrc ?? '', tlyric: value.tlyric ?? '', rlyric: value.rlyric ?? '' })
    }).catch(() => { if (mounted.current) setMessage('歌词读取失败，请返回重试') })
      .finally(() => { if (mounted.current) setBusy(false) })
    return () => { mounted.current = false }
  }, [track])
  const commit = async(reset: boolean) => {
    if (!track || busy || changed) return
    setBusy(true); setMessage('')
    try {
      if (reset) {
        const raw = await resetCurrentEditedLyric(track)
        if (mounted.current) setInfo({ lyric: raw.lyric, tlyric: raw.tlyric ?? '', rlyric: raw.rlyric ?? '' })
      } else if (!await saveCurrentEditedLyric(track, info)) {
        if (mounted.current) setMessage('歌词已保存；歌曲已切换，请重新打开编辑器')
        return
      }
      if (mounted.current) setMessage(reset ? '已恢复原始歌词' : '歌词已保存，当前播放已更新')
    } catch (error: unknown) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : '保存失败，请重试')
    } finally { if (mounted.current) setBusy(false) }
  }
  return <View style={{ paddingVertical: 12, gap: 10 }}>
    <Text size={15}>{track?.name ?? '没有正在播放的歌曲'}</Text>
    <Text size={12} color={theme['c-font-label']}>保留 LRC 时间标记，例如 [00:12.34]歌词。修改仅保存在本机，不会改写音乐文件。离开前请保存。</Text>
    {([['lyric', '原文歌词'], ['tlyric', '翻译歌词（可选）'], ['rlyric', '罗马音歌词（可选）']] as const).map(([key, label]) => <View key={key} style={{ gap: 6 }}>
      <Text size={13}>{label}</Text>
      <TextInput accessibilityLabel={label} multiline textAlignVertical="top" editable={!busy && !changed} maxLength={MAX_LYRIC_LENGTH}
        value={info[key]} onChangeText={text => { setInfo(value => ({ ...value, [key]: text })) }}
        style={{ minHeight: key == 'lyric' ? 180 : 90, maxHeight: 300, padding: 12, borderRadius: 6, color: theme['c-font'], backgroundColor: theme['c-primary-input-background'], fontSize: 13 }} />
    </View>)}
    <Text size={13}>{changed ? '歌曲已切换，请返回并重新打开编辑器' : message}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button disabled={busy || changed} onPress={() => { void commit(false) }}>{busy ? '处理中…' : '保存歌词'}</Button>
      <Button disabled={busy || changed} onPress={() => { void commit(true) }}>恢复原始歌词</Button>
    </View>
  </View>
}
