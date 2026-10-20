import { memo, useEffect, useRef } from 'react'
import { AppState, View } from 'react-native'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { checkDesktopLyricOverlayPermission, openDesktopLyricOverlayPermissionActivity } from '@/core/desktopLyric'
import { toast } from '@/utils/tools'
import CheckBoxItem from '../../components/CheckBoxItem'
import Wallpaper from '../Theme/Wallpaper'

export default memo(() => {
  const enabled = useSettingValue('player.lockScreenLyrics')
  const pending = useRef(false)
  const checking = useRef(false)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state != 'active' || !pending.current) return
      pending.current = false
      void checkDesktopLyricOverlayPermission().then(() => {
        updateSetting({ 'player.lockScreenLyrics': true })
      }).catch(() => { toast('未获得悬浮窗权限，锁屏黑胶歌词未开启') })
    })
    return () => { pending.current = false; subscription.remove() }
  }, [])
  const change = async(value: boolean) => {
    if (!value) { pending.current = false; updateSetting({ 'player.lockScreenLyrics': false }); return }
    if (checking.current) return
    checking.current = true
    try {
      await checkDesktopLyricOverlayPermission()
      updateSetting({ 'player.lockScreenLyrics': true })
    } catch {
      pending.current = true
      toast('请允许悬浮窗权限，授权后返回即可开启锁屏歌词')
      try { await openDesktopLyricOverlayPermissionActivity() } catch {
        pending.current = false
        toast('无法打开授权页面，请在系统应用设置中允许悬浮窗权限')
      }
    } finally { checking.current = false }
  }
  return <View style={{ marginTop: 5 }}>
    <CheckBoxItem check={enabled} label="锁屏黑胶歌词" onChange={value => { void change(value) }}
      helpDesc={'播放音乐时，锁屏亮起后显示竖屏黑胶与多行同步歌词。解锁或暂停后自动退出；熄屏不常亮。需要悬浮窗权限，部分手机还需允许“锁屏显示”或“后台弹出界面”。'} />
    <Wallpaper lockScreen />
  </View>
})
