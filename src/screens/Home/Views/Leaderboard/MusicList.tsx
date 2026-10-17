import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import OnlineList, { type OnlineListType, type OnlineListProps } from '@/components/OnlineList'
import { getBoardsList, getListDetail, setListDetail, setListDetailInfo } from '@/core/leaderboard'
import boardState from '@/store/leaderboard/state'
import { handlePlay } from './listAction'

export interface MusicListType { loadList: (source: LX.OnlineSource, listId: string, refresh?: boolean) => void }
export default forwardRef<MusicListType, {}>((props, ref) => {
  const listRef = useRef<OnlineListType>(null)
  const generation = useRef(0)
  const selected = useRef('')
  const busy = useRef(false)
  const load = async(id: string, page: number, refresh: boolean, append: boolean) => {
    const request = ++generation.current
    busy.current = true
    listRef.current?.setStatus(refresh ? 'refreshing' : 'loading')
    try {
      if (refresh) await getBoardsList(id.startsWith('tx__') ? 'tx' : 'wy', true)
      const detail = await getListDetail(id, page, refresh)
      if (request != generation.current || selected.current != id) return
      const result = setListDetail(detail, id, page)
      listRef.current?.setList(result.list, append)
      listRef.current?.setStatus(boardState.listDetailInfo.maxPage <= page ? 'end' : 'idle')
    } catch {
      if (request == generation.current) listRef.current?.setStatus('error')
    } finally { if (request == generation.current) busy.current = false }
  }
  useImperativeHandle(ref, () => ({
    loadList(source, id, refresh = false) {
      selected.current = id
      listRef.current?.setList([])
      setListDetailInfo(id)
      void load(id, 1, refresh, false)
    },
  }), [])
  useEffect(() => () => { generation.current++ }, [])
  const handleRefresh: OnlineListProps['onRefresh'] = () => { if (selected.current) void load(selected.current, 1, true, false) }
  const handleLoadMore: OnlineListProps['onLoadMore'] = () => {
    if (!selected.current || busy.current) return
    void load(selected.current, boardState.listDetailInfo.list.length ? boardState.listDetailInfo.page + 1 : 1, false, true)
  }
  return <OnlineList ref={listRef} onPlayList={index => { void handlePlay(selected.current, boardState.listDetailInfo.list, index) }}
    onRefresh={handleRefresh} onLoadMore={handleLoadMore} checkHomePagerIdle rowType="medium" />
})
