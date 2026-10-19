import { getList } from './songlist'
import { getData, saveData } from '@/plugins/storage'
import { log } from '@/utils/log'
import type { ListInfo, Source } from '@/store/songlist/state'

interface Cursor { page: number, maxPage: number }
const storageKey = '@songlist_discovery_cursor'
let cursorsPromise: Promise<Record<string, Cursor>> | undefined
const readCursors = async() => {
  cursorsPromise ??= getData<Record<string, Cursor>>(storageKey).then(value => value ?? {}).catch(error => {
    log.warn('Read discovery cursor failed', error)
    return {}
  })
  return cursorsPromise
}

// Keep display pages contiguous while starting each new batch after the last
// source page shown. Persist the cursor so reopening the app also changes batches.
export const createSonglistDiscovery = () => {
  const batch = { startPage: 1, selectionKey: '' }
  let generation = 0
  return {
    cancel() { generation++ },
    async load(source: Source, tagId: string, sortId: string, page: number, refresh = false): Promise<ListInfo> {
      const request = ++generation
      const key = JSON.stringify([source, tagId, sortId])
      const cursors = await readCursors()
      const cursor = cursors[key]
      let firstPage = batch.startPage
      if (page == 1) {
        firstPage = cursor && Number.isInteger(cursor.page) && cursor.page > 0 && cursor.page < cursor.maxPage ? cursor.page + 1 : 1
      } else if (batch.selectionKey != key) throw new Error('Discovery selection changed')
      let sourcePage = firstPage + page - 1
      let result = await getList(source, tagId, sortId, sourcePage, refresh || page == 1)
      // A service may have removed pages since the previous visit.
      if (page == 1 && sourcePage > 1 && !result.list.length) {
        firstPage = sourcePage = 1
        result = await getList(source, tagId, sortId, 1, true)
      }
      if (request == generation) {
        batch.startPage = firstPage
        batch.selectionKey = key
        cursors[key] = { page: sourcePage, maxPage: Math.max(1, Math.ceil(result.total / result.limit)) }
        void saveData(storageKey, { ...cursors }).catch(error => { log.warn('Save discovery cursor failed', error) })
      }
      return {
        ...result,
        page,
        total: Math.max(0, result.total - (firstPage - 1) * result.limit),
      }
    },
  }
}
