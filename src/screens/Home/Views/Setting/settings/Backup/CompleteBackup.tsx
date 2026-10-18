import { useRef, useState } from 'react'
import { Modal, View } from 'react-native'
import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { confirmDialog, tipDialog, toast } from '@/utils/tools'
import { exitApp } from '@/utils/nativeModules/utils'
import { exportBackupFile, readBackupFile, restoreBackup, type BackupKind } from '@/core/backup'
import { pause } from '@/core/player/player'
import playerState from '@/store/player/state'
import SubTitle from '../../components/SubTitle'
import Button from '../../components/Button'

export default () => {
  const theme = useTheme()
  const chooser = useRef<ChoosePathType>(null)
  const selected = useRef<{ kind: BackupKind, action: 'import' | 'export' }>({ kind: 'full', action: 'export' })
  const working = useRef(false)
  const [busy, setBusy] = useState(false)
  const open = (kind: BackupKind, action: 'import' | 'export') => {
    if (working.current) return
    selected.current = { kind, action }
    chooser.current?.show({ title: action == 'import' ? '选择 MUSIC++ 备份 JSON 文件' : '选择备份保存目录', dirOnly: action == 'export', filter: ['json'] })
  }
  const confirm = async(path: string) => {
    if (working.current) return
    working.current = true; setBusy(true)
    const { kind, action } = selected.current
    let requiresRestart = false
    try {
      if (action == 'export') {
        await exportBackupFile(path, kind)
        toast('备份已保存并通过校验')
      } else {
        const data = await readBackupFile(path)
        if (data.kind != kind) throw new Error(`此文件是${data.kind == 'full' ? '完整数据' : '设置'}备份，请使用对应的恢复按钮`)
        if (!await confirmDialog({ title: '恢复备份', message: `${kind == 'full' ? '此操作会替换当前设置、歌单和备份包含的用户数据。' : '此操作会替换当前软件设置。'}请仅恢复可信备份，完整备份也会恢复自定义源脚本。恢复成功后需关闭并重新打开软件。`, bgClose: false })) return
        if (playerState.isPlay) await pause()
        await restoreBackup(data)
        requiresRestart = true
        await tipDialog({ title: '恢复完成', message: '数据已恢复。请关闭软件后重新打开，目录和外部图片可能需要重新授权或选择。', btnText: '关闭软件', bgClose: false })
        exitApp()
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name == 'StorageRestoreRecoveryError') {
        requiresRestart = true
        await tipDialog({ title: '需要重新打开软件', message: error.message, btnText: '关闭软件', bgClose: false })
        exitApp()
      } else toast(error instanceof Error ? error.message : '备份操作失败，请重试')
    } finally { if (!requiresRestart) { working.current = false; setBusy(false) } }
  }
  return <>
    <SubTitle title="设置与完整数据备份">
      <Text size={12} color={theme['c-font-label']}>完整备份包含设置、歌单、播放历史、自定义源及歌词；不包含音乐文件、下载任务、目录授权和外部图片文件。设置备份仅包含软件设置与主题配置。</Text>
      {(['settings', 'full'] as const).map(kind => <View key={kind} style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 }}>
        <Button disabled={busy} onPress={() => { open(kind, 'export') }}>{kind == 'full' ? '导出完整备份' : '导出设置'}</Button>
        <Button disabled={busy} onPress={() => { open(kind, 'import') }}>{kind == 'full' ? '恢复完整备份' : '恢复设置'}</Button>
      </View>)}
    </SubTitle>
    <ChoosePath ref={chooser} onConfirm={path => { void confirm(path) }} />
    <Modal visible={busy} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: '#0008', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ padding: 24, borderRadius: 8, backgroundColor: theme['c-content-background'] }}><Text>正在处理备份，请稍候…</Text></View>
      </View>
    </Modal>
  </>
}
