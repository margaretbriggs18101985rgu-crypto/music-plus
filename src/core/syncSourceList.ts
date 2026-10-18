// import { dateFormat } from '@/utils/common'
import { setListUpdateTime } from '@/utils/data'
import { overwriteListMusics, setFetchingListStatus } from './list'
import { getListDetailAll } from '@/core/songlist'
import { getListDetailAll as getBoardListAll } from '@/core/leaderboard'
import listState from '@/store/list/state'

const pending = new Map<string, Promise<boolean>>()

const fetchList = async(id: string, source: LX.OnlineSource, sourceListId: string) => {
  setFetchingListStatus(id, true)

  let promise
  if (/^board__/.test(sourceListId)) {
    const id = sourceListId.replace(/^board__/, '')
    promise = id ? getBoardListAll(id, true) : Promise.reject(new Error('id not defined: ' + sourceListId))
  } else {
    promise = getListDetailAll(source, sourceListId, true)
  }
  return promise.finally(() => {
    setFetchingListStatus(id, false)
  })
}

export default async(targetListInfo: LX.List.UserListInfo, options: { shouldApply?: () => boolean, automatic?: boolean } = {}) => {
  if (!targetListInfo.source || !targetListInfo.sourceListId) return false
  const existing = pending.get(targetListInfo.id)
  if (existing) return existing
  const task = (async() => {
    const list = await fetchList(targetListInfo.id, targetListInfo.source!, targetListInfo.sourceListId!)
    if (!Array.isArray(list)) throw new Error('Invalid remote playlist')
    // Never recreate a deleted collection or apply a response for an old binding.
    const current = listState.userList.find(item => item.id == targetListInfo.id)
    if (!current || current.source != targetListInfo.source || current.sourceListId != targetListInfo.sourceListId || options.shouldApply?.() === false) return false
    // Empty automatic responses require a manual refresh before erasing saved tracks.
    if (options.automatic && !list.length) return false
    await overwriteListMusics(targetListInfo.id, list)
    await setListUpdateTime(targetListInfo.id, Date.now())
    return true
  })()
  pending.set(targetListInfo.id, task)
  try { return await task } finally { pending.delete(targetListInfo.id) }
}
