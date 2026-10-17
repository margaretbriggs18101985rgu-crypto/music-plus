import { useRef, useState } from 'react'
import { Modal, TouchableOpacity, View } from 'react-native'
import InlineOptions, { OFFICIAL_PLATFORMS } from '@/components/common/InlineOptions'
import Input from '@/components/common/Input'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { getListDetail, getListDetailAll } from '@/core/songlist'
import { createList } from '@/core/list'
import { toMD5, toast } from '@/utils/tools'
import listState from '@/store/list/state'
import musicSdk from '@/utils/musicSdk'

export default ({ visible, onClose }: { visible: boolean, onClose: () => void }) => {
  const theme = useTheme()
  const [link, setLink] = useState('')
  const [source, setSource] = useState<'wy' | 'tx'>('wy')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const running = useRef(false)
  const importList = async() => {
    if (running.current || !link.trim()) return
    running.current = true; setBusy(true); setError('')
    try {
      const url = link.match(/https?:\/\/[^\s<>"，]+/)?.[0] ?? link.trim()
      if (!/^https?:\/\//i.test(url) && !/^\d+$/.test(url)) throw new Error('请输入歌单分享链接或歌单 ID')
      const detected = /(?:music\.163\.com|163cn\.tv|163cn\.com)/i.test(url) ? 'wy' : /(?:y\.qq\.com|c6\.y\.qq\.com)/i.test(url) ? 'tx' : source
      if (/^https?:\/\//i.test(url) && !/^https?:\/\/(?:[\w-]+\.)?(?:music\.163\.com|163cn\.tv|163cn\.com|y\.qq\.com)(?=[:/])/i.test(url)) throw new Error('请使用网易云音乐或 QQ 音乐的歌单分享链接')
      const parsed: unknown = await musicSdk[detected].songList.getListId(url)
      const id = typeof parsed == 'object' && parsed !== null && 'id' in parsed ? String(parsed.id) : String(parsed)
      if (!/^\d+$/.test(id)) throw new Error('无法识别歌单，请检查分享链接')
      if (listState.userList.some(item => item.source == detected && (item.sourceListId == id || item.sourceListId == `${detected}__${id}`))) throw new Error('该歌单已在我的歌单中，可从歌单菜单同步更新')
      const detail = await getListDetail(id, detected, 1, true)
      const songs = await getListDetailAll(detected, id)
      if (!songs.length) throw new Error('歌单为空、未公开或平台暂时无法访问')
      await createList({ id: `${detected}_${toMD5(`${detected}__${id}`)}`, name: detail.info.name ?? `导入歌单 ${id}`, list: songs, source: detected, sourceListId: id })
      setLink(''); onClose(); toast(`已导入 ${songs.length} 首歌曲`)
    } catch (error: unknown) { setError(error instanceof Error ? error.message : '导入失败，请稍后重试') } finally { running.current = false; setBusy(false) }
  }
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) onClose() }}>
    <View style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'center', padding: 24 }}>
      <View style={{ borderRadius: 12, backgroundColor: theme['c-content-background'], padding: 20 }}>
        <Text size={20}>导入歌单</Text>
        <Text size={13} color={theme['c-font-label']} style={{ marginVertical: 16 }}>粘贴网易云音乐或 QQ 音乐的歌单分享链接</Text>
        <Input accessibilityLabel="歌单链接" value={link} onChangeText={setLink} editable={!busy} placeholder="输入歌单链接或 ID" style={{ minHeight: 48, borderRadius: 6, backgroundColor: theme['c-primary-input-background'] }} />
        <View pointerEvents={busy ? 'none' : 'auto'}><InlineOptions value={source} options={OFFICIAL_PLATFORMS} onChange={setSource} size={13} /></View>
        <Text size={12} color={theme['c-font-label']}>分享链接自动识别平台，输入 ID 时选择平台</Text>
        {error ? <Text size={13} style={{ marginVertical: 10 }}>{error}</Text> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <TouchableOpacity disabled={busy} onPress={onClose} style={{ minHeight: 48, paddingHorizontal: 16, justifyContent: 'center' }}><Text>取消</Text></TouchableOpacity>
          <TouchableOpacity disabled={busy || !link.trim()} onPress={() => { void importList() }} style={{ minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', opacity: busy || !link.trim() ? 0.5 : 1 }}><Text>{busy ? '正在导入…' : '导入'}</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
}
