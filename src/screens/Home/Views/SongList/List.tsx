import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import Songlist, { type SonglistProps, type SonglistType } from './components/Songlist'
import { setList, setListInfo } from '@/core/songlist'
import { createSonglistDiscovery } from '@/core/songlistDiscovery'
import songlistState from '@/store/songlist/state'
import { type Source } from '@/store/songlist/state'


export interface ListType {
  loadList: (source: Source, sortId: string, tagId: string, refresh?: boolean) => void
}

export default forwardRef<ListType, {}>((props, ref) => {
  const listRef = useRef<SonglistType>(null)
  const isUnmountedRef = useRef(false)
  const generation = useRef(0)
  const discovery = useRef<ReturnType<typeof createSonglistDiscovery>>()
  discovery.current ??= createSonglistDiscovery()
  const loading = useRef(false)
  useImperativeHandle(ref, () => ({
    async loadList(source, sortId, tagId, refresh = false) {
      const request = ++generation.current
      loading.current = true
      const previous = songlistState.listInfo
      const keepList = previous.source == source && previous.sortId == sortId && previous.tagId == tagId && previous.list.length > 0
      if (keepList) listRef.current?.setStatus('refreshing')
      else {
        listRef.current?.setList([])
        listRef.current?.setStatus('loading')
        setListInfo(source, tagId, sortId)
      }
      const page = 1
      return discovery.current!.load(source, tagId, sortId, page, refresh).then((info) => {
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
        listRef.current?.setStatus('error')
      }).finally(() => { if (request == generation.current) loading.current = false })
    },
  }), [])

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
      discovery.current?.cancel()
    }
  }, [])


  const handleRefresh: SonglistProps['onRefresh'] = () => {
    const request = ++generation.current
    loading.current = true
    const selection = { ...songlistState.listInfo }
    const page = 1
    listRef.current?.setStatus('refreshing')
    discovery.current!.load(selection.source, selection.tagId, selection.sortId, page, true).then((info) => {
      if (request != generation.current || isUnmountedRef.current) return
      const result = setList(info, selection.tagId, selection.sortId, page)
      if (isUnmountedRef.current) return
      listRef.current?.setList(result.list)
      listRef.current?.setStatus(songlistState.listInfo.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      if (request != generation.current || isUnmountedRef.current) return
      listRef.current?.setStatus('error')
    }).finally(() => { if (request == generation.current) loading.current = false })
  }
  const handleLoadMore: SonglistProps['onLoadMore'] = () => {
    if (loading.current) return
    loading.current = true
    const request = generation.current
    const selection = { ...songlistState.listInfo }
    listRef.current?.setStatus('loading')
    const page = songlistState.listInfo.list.length ? songlistState.listInfo.page + 1 : 1
    discovery.current!.load(selection.source, selection.tagId, selection.sortId, page).then((info) => {
      if (request != generation.current || isUnmountedRef.current) return
      const result = setList(info, selection.tagId, selection.sortId, page)
      if (isUnmountedRef.current) return
      listRef.current?.setList(result.list)
      listRef.current?.setStatus(songlistState.listInfo.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      if (request != generation.current || isUnmountedRef.current) return
      listRef.current?.setStatus('error')
    }).finally(() => { if (request == generation.current) loading.current = false })
  }

  return <Songlist
    ref={listRef}
    onRefresh={handleRefresh}
    onLoadMore={handleLoadMore}
   />
})

