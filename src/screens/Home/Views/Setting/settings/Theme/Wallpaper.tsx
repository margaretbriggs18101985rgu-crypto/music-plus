import { memo, useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import CheckBox from '@/components/common/CheckBox'
import SubTitle from '../../components/SubTitle'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { extname, existsFile, mkdir, privateStorageDirectoryPath, selectFile, unlink } from '@/utils/fs'
import { toast, tipDialog } from '@/utils/tools'
import { shareFile } from '@/utils/nativeModules/utils'

const WALLPAPER_DIR = `${privateStorageDirectoryPath}/wallpapers`
type Scope = LX.AppSetting['theme.wallpaper.scope']

const removeImportedWallpaper = async(path: string) => {
  if (!path.startsWith(`${WALLPAPER_DIR}/`)) return
  const folder = path.slice(0, path.lastIndexOf('/'))
  await unlink(folder == WALLPAPER_DIR ? path : folder).catch(() => {})
}

export default memo(({ lockScreen = false }: { lockScreen?: boolean }) => {
  const t = useI18n()
  const path = useSettingValue(lockScreen ? 'player.lockScreenWallpaper.path' : 'theme.wallpaper.path')
  const name = useSettingValue(lockScreen ? 'player.lockScreenWallpaper.name' : 'theme.wallpaper.name')
  const kind = useSettingValue(lockScreen ? 'player.lockScreenWallpaper.kind' : 'theme.wallpaper.kind')
  const scope = useSettingValue('theme.wallpaper.scope')
  const [busy, setBusy] = useState(false)
  const scopeOptions = useMemo<Array<{ id: Scope, label: string }>>(() => [
    { id: 'all', label: t('setting_wallpaper_scope_all') },
    { id: 'player', label: t('setting_wallpaper_scope_player') },
    { id: 'pages', label: t('setting_wallpaper_scope_pages') },
  ], [t])

  const saveWallpaper = useCallback((nextPath: string, nextName: string, nextKind: LX.AppSetting['theme.wallpaper.kind']) => {
    if (lockScreen) {
      if (nextKind == 'mpkg') return
      updateSetting({ 'player.lockScreenWallpaper.path': nextPath, 'player.lockScreenWallpaper.name': nextName, 'player.lockScreenWallpaper.kind': nextKind })
    } else updateSetting({ 'theme.wallpaper.path': nextPath, 'theme.wallpaper.name': nextName, 'theme.wallpaper.kind': nextKind })
  }, [lockScreen])

  const choose = useCallback(async() => {
    if (busy) return
    setBusy(true)
    const importDirectory = `${WALLPAPER_DIR}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    try {
      if (!await existsFile(WALLPAPER_DIR)) await mkdir(WALLPAPER_DIR)
      await mkdir(importDirectory)
      // Android's MIME registry has no standard .mpkg entry, so use the openable
      // file picker and validate the extension after the user selects a file.
      const file = await selectFile({ mimeTypes: ['*/*'], toPath: importDirectory })
      if (!file?.isFile || typeof file.data != 'string' || !file.data) {
        await unlink(importDirectory).catch(() => {})
        return
      }
      const extension = extname(file.name).toLowerCase()
      if (!['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mkv', 'mpkg'].includes(extension) || (lockScreen && extension == 'mpkg')) {
        await unlink(importDirectory).catch(() => {})
        toast(lockScreen ? '锁屏背景支持 JPG、PNG、WebP、GIF 和 MP4、WebM、MKV 视频' : t('setting_wallpaper_unsupported'), 'long')
        return
      }
      const nextKind: LX.AppSetting['theme.wallpaper.kind'] = extension == 'mpkg' ? 'mpkg' : ['mp4', 'webm', 'mkv'].includes(extension) ? 'video' : extension == 'gif' ? 'gif' : 'image'
      const previousPath = path
      saveWallpaper(file.data, file.name, nextKind)
      if (previousPath != file.data) void removeImportedWallpaper(previousPath)
      if (nextKind == 'mpkg') {
        await tipDialog({ title: t('setting_wallpaper_mpkg_title'), message: t('setting_wallpaper_mpkg_message'), btnText: t('dialog_confirm'), bgClose: false })
      } else toast(t('setting_wallpaper_imported'))
    } catch (error: unknown) {
      await unlink(importDirectory).catch(() => {})
      toast(error instanceof Error ? error.message : t('setting_wallpaper_import_failed'), 'long')
    } finally { setBusy(false) }
  }, [busy, path, t, lockScreen, saveWallpaper])

  const clear = useCallback(() => {
    void removeImportedWallpaper(path)
    saveWallpaper('', '', 'none')
  }, [path, saveWallpaper])

  return (
    <SubTitle title={lockScreen ? '锁屏自定义背景' : t('setting_wallpaper_title')}>
      <Text size={12} color="#888" style={styles.help}>{lockScreen ? '仅用于锁屏黑胶，支持图片、GIF 和静音视频。未设置时显示黑色星空，星空参数跟随播放器设置。' : t('setting_wallpaper_help')}</Text>
      <View style={styles.actions}>
        <Button style={styles.button} onPress={() => { void choose() }} disabled={busy}>
          <Text size={13}>{busy ? t('setting_wallpaper_importing') : t('setting_wallpaper_choose')}</Text>
        </Button>
        {path ? <Button style={styles.button} onPress={clear}>
          <Text size={13}>{lockScreen ? '恢复黑色星空' : t('setting_wallpaper_clear')}</Text>
        </Button> : null}
      </View>
      {name ? <Text size={12} numberOfLines={1} ellipsizeMode="middle">{name} ({kind})</Text> : null}
      {path && kind == 'mpkg' ? <Text size={12} color="#D68A2C" style={styles.notice}>{t('setting_wallpaper_mpkg_status')}</Text> : null}
      {path && kind == 'mpkg' ? <Button style={styles.externalButton} onPress={() => {
        void shareFile(path, 'application/octet-stream', t('setting_wallpaper_open_external')).catch(error => {
          toast(error instanceof Error ? error.message : t('setting_wallpaper_import_failed'), 'long')
        })
      }}>
        <Text size={13}>{t('setting_wallpaper_open_external')}</Text>
      </Button> : null}
      {!lockScreen ? <View style={styles.scopes}>
        {scopeOptions.map(item => (
          <CheckBox key={item.id} check={scope == item.id} label={item.label}
            onChange={() => { updateSetting({ 'theme.wallpaper.scope': item.id }) }} need />
        ))}
      </View> : null}
    </SubTitle>
  )
})

const styles = StyleSheet.create({
  help: { marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  button: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, backgroundColor: 'rgba(128,128,128,0.16)' },
  scopes: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  notice: { marginTop: 6 },
  externalButton: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, marginTop: 8, borderRadius: 6, backgroundColor: 'rgba(128,128,128,0.16)' },
})
