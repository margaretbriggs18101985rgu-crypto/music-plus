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

export default memo(() => {
  const t = useI18n()
  const path = useSettingValue('theme.wallpaper.path')
  const name = useSettingValue('theme.wallpaper.name')
  const kind = useSettingValue('theme.wallpaper.kind')
  const scope = useSettingValue('theme.wallpaper.scope')
  const [busy, setBusy] = useState(false)
  const scopeOptions = useMemo<Array<{ id: Scope, label: string }>>(() => [
    { id: 'all', label: t('setting_wallpaper_scope_all') },
    { id: 'player', label: t('setting_wallpaper_scope_player') },
    { id: 'pages', label: t('setting_wallpaper_scope_pages') },
  ], [t])

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
      if (!['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mkv', 'mpkg'].includes(extension)) {
        await unlink(importDirectory).catch(() => {})
        toast(t('setting_wallpaper_unsupported'), 'long')
        return
      }
      const nextKind: LX.AppSetting['theme.wallpaper.kind'] = extension == 'mpkg' ? 'mpkg' : ['mp4', 'webm', 'mkv'].includes(extension) ? 'video' : extension == 'gif' ? 'gif' : 'image'
      const previousPath = path
      updateSetting({ 'theme.wallpaper.path': file.data, 'theme.wallpaper.name': file.name, 'theme.wallpaper.kind': nextKind })
      if (previousPath != file.data) void removeImportedWallpaper(previousPath)
      if (nextKind == 'mpkg') {
        await tipDialog({ title: t('setting_wallpaper_mpkg_title'), message: t('setting_wallpaper_mpkg_message'), btnText: t('dialog_confirm'), bgClose: false })
      } else toast(t('setting_wallpaper_imported'))
    } catch (error: unknown) {
      await unlink(importDirectory).catch(() => {})
      toast(error instanceof Error ? error.message : t('setting_wallpaper_import_failed'), 'long')
    } finally { setBusy(false) }
  }, [busy, path, t])

  const clear = useCallback(() => {
    void removeImportedWallpaper(path)
    updateSetting({ 'theme.wallpaper.path': '', 'theme.wallpaper.name': '', 'theme.wallpaper.kind': 'none' })
  }, [path])

  return (
    <SubTitle title={t('setting_wallpaper_title')}>
      <Text size={12} color="#888" style={styles.help}>{t('setting_wallpaper_help')}</Text>
      <View style={styles.actions}>
        <Button style={styles.button} onPress={() => { void choose() }} disabled={busy}>
          <Text size={13}>{busy ? t('setting_wallpaper_importing') : t('setting_wallpaper_choose')}</Text>
        </Button>
        {path ? <Button style={styles.button} onPress={clear}>
          <Text size={13}>{t('setting_wallpaper_clear')}</Text>
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
      <View style={styles.scopes}>
        {scopeOptions.map(item => (
          <CheckBox key={item.id} check={scope == item.id} label={item.label}
            onChange={() => { updateSetting({ 'theme.wallpaper.scope': item.id }) }} need />
        ))}
      </View>
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
