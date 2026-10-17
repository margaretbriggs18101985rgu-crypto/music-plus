import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import Songlist, { type SonglistProps, type SonglistType } from './components/Songlist'
import { clearList, getList, setList, setListInfo } from '@/core/songlist'
import songlistState from '@/store/songlist/state'
import { type Source } from '@/store/songlist/state'


export interface ListType {
  loadList: (source: Source, sortId: string, tagId: string, refresh?: boolean) => void
}

export default forwardRef<ListType, {}>((props, ref) => {
  const listRef = useRef<SonglistType>(null)
  const isUnmountedRef = useRef(false)
  const generation = useRef(0)
  useImperativeHandle(ref, () => ({
    async loadList(source, sortId, tagId, refresh = false) {
      const request = ++generation.current
      const listInfo = songlistState.listInfo
      listRef.current?.setList([])
      if (!refresh && listInfo.tagId == tagId && listInfo.sortId == sortId && listInfo.source == source && listInfo.list.length) {
        requestAnimationFrame(() => {
          if (request != generation.current || isUnmountedRef.current) return
          listRef.current?.setList(listInfo.list)
        })
      } else {
        listRef.current?.setStatus('loading')
        setListInfo(source, tagId, sortId)
        const page = 1
        return getList(source, tagId, sortId, page, refresh).then((info) => {
          if (request != generation.current || isUnmountedRef.current) return
          const result = setList(info, tagId, sortId, page)
          if (isUnmountedRef.current) return
          requestAnimationFrame(() => {
            if (request != generation.current || isUnmountedRef.current) return
            listRef.current?.setList(result.list)
            listRef.current?.setStatus(songlistState.listInfo.maxPage <= page ? 'end' : 'idle')
          })
        }).catch(() => {
          if (request != generation.current || isUnmountedRef.current) return
          if (songlistState.listInfo.list.length && page == 1) clearList()
          listRef.current?.setStatus('error')
        })
      }
    },
  }), [])

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])


  const handleRefresh: SonglistProps['onRefresh'] = () => {
    const request = ++generation.current
    const selection = { ...songlistState.listInfo }
    const page = 1
    listRef.current?.setStatus('refreshing')
    getList(selection.source, selection.tagId, selection.sortId, page, true).then((info) => {
      if (request != generation.current || isUnmountedRef.current) return
      const result = setList(info, selection.tagId, selection.sortId, page)
      if (isUnmountedRef.current) return
      listRef.current?.setList(result.list)
      listRef.current?.setStatus(songlistState.listInfo.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      if (request != generation.current || isUnmountedRef.current) return
      if (songlistState.listInfo.list.length && page == 1) clearList()
      listRef.current?.setStatus('error')
    })
  }
  const handleLoadMore: SonglistProps['onLoadMore'] = () => {
    const request = generation.current
    const selection = { ...songlistState.listInfo }
    listRef.current?.setStatus('loading')
    const page = songlistState.listInfo.list.length ? songlistState.listInfo.page + 1 : 1
    getList(selection.source, selection.tagId, selection.sortId, page).then((info) => {
      if (request != generation.current || isUnmountedRef.current) return
      const result = setList(info, selection.tagId, selection.sortId, page)
      if (isUnmountedRef.current) return
      listRef.current?.setList(result.list)
      listRef.current?.setStatus(songlistState.listInfo.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      if (request != generation.current || isUnmountedRef.current) return
      if (songlistState.listInfo.list.length && page == 1) clearList()
      listRef.current?.setStatus('error')
    })
  }

  return <Songlist
    ref={listRef}
    onRefresh={handleRefresh}
    onLoadMore={handleLoadMore}
   />
})

