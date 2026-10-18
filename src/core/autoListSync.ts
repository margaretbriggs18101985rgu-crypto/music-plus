import { AppState } from 'react-native'
import listState from '@/store/list/state'
import { getListUpdateInfo, setListAutoUpdate } from '@/utils/data'
import syncSourceList from './syncSourceList'
import { confirmDialog, toast } from '@/utils/tools'

const SYNC_INTERVAL = 6 * 60 * 60 * 1000
const RETRY_INTERVAL = 15 * 60 * 1000
const runtime = { started: false, running: false, attempts: new Map<string, number>() }

export const checkAutoListSync = async() => {
  if (runtime.running || AppState.currentState != 'active') return
  runtime.running = true
  try {
    const info = await getListUpdateInfo()
    for (const item of [...listState.userList]) {
      if (AppState.currentState != 'active') break
      const state = info[item.id]
      if (!item.source || !item.sourceListId || !state?.isAutoUpdate) continue
      const now = Date.now()
      if (now - state.updateTime < SYNC_INTERVAL || now - (runtime.attempts.get(item.id) ?? 0) < RETRY_INTERVAL) continue
      runtime.attempts.set(item.id, now)
      try {
        await syncSourceList({ ...item }, { automatic: true, shouldApply: () => !!info[item.id]?.isAutoUpdate })
      } catch (error) { console.warn('Playlist auto sync failed', item.id, error) }
    }
  } catch (error) { console.warn('Playlist auto sync settings unavailable', error) } finally { runtime.running = false }
}

export const startAutoListSync = () => {
  if (runtime.started) return
  runtime.started = true
  void checkAutoListSync()
  AppState.addEventListener('change', state => { if (state == 'active') void checkAutoListSync() })
  setInterval(() => { void checkAutoListSync() }, RETRY_INTERVAL)
}

export const toggleAutoListSync = async(item: LX.List.UserListInfo) => {
  const info = await getListUpdateInfo()
  const enable = !info[item.id]?.isAutoUpdate
  if (enable && !await confirmDialog({
    title: '开启歌单自动同步',
    message: '应用在前台时每 6 小时从原平台刷新此歌单，会替换该歌单在本机的歌曲列表。自动同步收到空结果时保留本地歌曲，可通过手动同步确认更新。',
  })) return
  await setListAutoUpdate(item.id, enable)
  runtime.attempts.delete(item.id)
  toast(enable ? '已开启此歌单的自动同步' : '已关闭此歌单的自动同步')
  if (enable) void checkAutoListSync()
}
