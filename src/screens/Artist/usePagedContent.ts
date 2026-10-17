import { useCallback, useEffect, useRef, useState } from 'react'

interface Page<T> { list: T[], more: boolean, nextOffset?: number }
// Each screen owns its requests; stale results cannot replace a refreshed list.
export default function usePagedContent<T extends { id: string }, P extends Page<T>>(fetchPage: (offset: number) => Promise<P>, loadAll = false) {
  const [list, setList] = useState<T[]>([])
  const [firstPage, setFirstPage] = useState<P>()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const state = useRef({ generation: 0, pending: false, more: false, offset: 0 })
  const load = useCallback(async(reset = false, refresh = false) => {
    const current = state.current
    if (!reset && (current.pending || !current.more)) return
    if (reset) current.generation++
    const generation = current.generation
    let offset = reset ? 0 : current.offset
    current.pending = true
    setError(''); setLoading(true); setRefreshing(refresh)
    try {
      let replace = reset
      do {
        const page = await fetchPage(offset)
        if (state.current.generation != generation) return
        current.offset = page.nextOffset ?? offset + page.list.length
        current.more = page.more && current.offset > offset
        if (replace) setFirstPage(page)
        const clear = replace
        setList(previous => [...new Map((clear ? page.list : [...previous, ...page.list]).map(item => [item.id, item])).values()])
        replace = false
        offset = current.offset
        if (!loadAll) break
      } while (current.more)
    } catch (error) {
      if (state.current.generation == generation) setError(error instanceof Error ? error.message : '加载失败，请重试')
    } finally {
      if (state.current.generation == generation) { current.pending = false; setLoading(false); setRefreshing(false) }
    }
  }, [fetchPage, loadAll])
  useEffect(() => {
    const current = state.current
    setList([]); setFirstPage(undefined)
    void load(true)
    return () => { current.generation++ }
  }, [load])
  return { list, firstPage, loading, refreshing, error, more: state.current.more, loadMore: () => { if (!error) void load() }, retry: () => { void load(!list.length) }, refresh: () => { void load(true, true) } }
}
