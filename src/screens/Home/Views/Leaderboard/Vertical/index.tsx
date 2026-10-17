import { useEffect, useRef, useState } from 'react'
import { AppState, View } from 'react-native'
import MusicList, { type MusicListType } from '../MusicList'
import { getLeaderboardSetting, saveLeaderboardSetting } from '@/utils/data'
import HeaderBar, { type HeaderBarType } from './HeaderBar'
import BoardsList, { type BoardsListType } from '../BoardsList'
import commonState from '@/store/common/state'
import { getBoardsList } from '@/core/leaderboard'
import { animateLayoutChange } from '@/components/common/InlineOptions'
import { handleCollect, handlePlay } from '../listAction'
import boardState from '@/store/leaderboard/state'
import { toast } from '@/utils/tools'

const REFRESH_INTERVAL = 5 * 60_000
export default () => {
  const [expanded, setExpanded] = useState(false)
  const musicList = useRef<MusicListType>(null)
  const boards = useRef<BoardsListType>(null)
  const header = useRef<HeaderBarType>(null)
  const selection = useRef<{ source: LX.OnlineSource, id: string }>({ source: 'wy', id: 'wy__3778678' })
  const generation = useRef(0)
  const lastRefresh = useRef(0)
  const initialized = useRef(false)
  const cancelRequests = () => { generation.current++ }

  const loadSource = async(source: LX.OnlineSource, preferred?: string) => {
    const request = ++generation.current
    header.current?.setBound(source, preferred ?? '', '同步中…')
    try {
      const list = await getBoardsList(source, true)
      if (request != generation.current) return
      const board = list.find(item => item.id == preferred) ?? list.find(item => item.id == (source == 'tx' ? 'tx__26' : 'wy__3778678')) ?? list[0]
      if (!board) throw new Error('空榜单')
      selection.current = { source, id: board.id }
      initialized.current = true
      boards.current?.setList(list, board.id)
      header.current?.setBound(source, board.id, board.name)
      void saveLeaderboardSetting({ source, boardId: board.id })
      lastRefresh.current = Date.now()
      musicList.current?.loadList(source, board.id, true)
    } catch {
      if (request != generation.current) return
      const previous = selection.current
      toast('榜单同步失败，请检查网络后重试')
      if (!initialized.current) {
        const id = preferred?.startsWith(`${source}__`) ? preferred : source == 'tx' ? 'tx__26' : 'wy__3778678'
        selection.current = { source, id }
        header.current?.setBound(source, id, '同步失败，点击重试')
        musicList.current?.loadList(source, id, true)
      } else header.current?.setBound(previous.source, previous.id, boardState.boards[previous.source]?.list.find(item => item.id == previous.id)?.name ?? '下拉重试')
    }
  }
  const refreshIfVisible = () => {
    if (commonState.navActiveId != 'nav_top' || AppState.currentState != 'active') return
    if (Date.now() - lastRefresh.current < REFRESH_INTERVAL) return
    void loadSource(selection.current.source, selection.current.id)
  }
  useEffect(() => {
    let mounted = true
    void getLeaderboardSetting().then(({ source, boardId }) => {
      if (mounted) void loadSource(source == 'tx' ? 'tx' : 'wy', boardId)
    })
    const onNav = (id: string) => { if (id == 'nav_top') refreshIfVisible() }
    global.state_event.on('navActiveIdUpdated', onNav)
    const app = AppState.addEventListener('change', state => { if (state == 'active') refreshIfVisible() })
    const timer = setInterval(refreshIfVisible, REFRESH_INTERVAL)
    return () => { mounted = false; cancelRequests(); clearInterval(timer); app.remove(); global.state_event.off('navActiveIdUpdated', onNav) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const chooseBoard = (id: string) => {
    const source = selection.current.source
    selection.current.id = id
    header.current?.setBound(source, id, boardState.boards[source]?.list.find(item => item.id == id)?.name ?? '')
    void saveLeaderboardSetting({ source, boardId: id })
    musicList.current?.loadList(source, id, true)
    animateLayoutChange(); setExpanded(false)
  }
  return <View style={{ flex: 1 }}>
    <HeaderBar expanded={expanded} ref={header} onShowBound={() => { if (initialized.current) { animateLayoutChange(); setExpanded(value => !value) } else void loadSource(selection.current.source, selection.current.id) }} onSourceChange={source => { animateLayoutChange(); setExpanded(false); void loadSource(source) }} />
    <View style={{ height: expanded ? 240 : 0, overflow: 'hidden' }}>
      <BoardsList ref={boards} onBoundChange={chooseBoard}
        onPlay={id => { void handlePlay(id, id == boardState.listDetailInfo.id ? boardState.listDetailInfo.list : []) }}
        onCollect={(id, name) => { void handleCollect(id, name, selection.current.source) }} />
    </View>
    <MusicList ref={musicList} />
  </View>
}
