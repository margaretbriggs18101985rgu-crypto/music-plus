import searchState from '@/store/search/state'
import searchActions from '@/store/search/action'
import { getSearchHistory as getSearchHistoryFromStore, saveSearchHistory } from '@/utils/data'
import settingState from '@/store/setting/state'


export const setSearchType: typeof searchActions['setSearchType'] = (type) => {
  searchActions.setSearchType(type)
}
export const setSearchText: typeof searchActions['setSearchText'] = (text) => {
  searchActions.setSearchText(text)
}
export const setTipListInfo: typeof searchActions['setTipListInfo'] = (text, source) => {
  searchActions.setTipListInfo(text, source)
}
export const setTipList: typeof searchActions['setTipList'] = (list) => {
  searchActions.setTipList(list)
}

let historyLoaded = false
let historyLoad: Promise<void> | null = null

export const getSearchHistory = async() => {
  if (!historyLoaded) {
    historyLoad ??= getSearchHistoryFromStore().then(list => {
      // A clear or removal during the disk read must take precedence.
      if (historyLoaded) return
      searchActions.setHistoryWord(list)
      historyLoaded = true
    }).finally(() => { historyLoad = null })
    await historyLoad
  }
  return [...searchState.historyList]
}
export const addHistoryWord = async(word: string) => {
  word = word.trim()
  if (!settingState.setting['search.isShowHistorySearch'] || !word) return
  await getSearchHistory()
  if (!settingState.setting['search.isShowHistorySearch']) return
  const list = searchActions.addHistoryWord(word)
  if (!list) return
  void saveSearchHistory(list)
}
export const removeHistoryWord = (index: number) => {
  if (index < 0 || index >= searchState.historyList.length) return
  historyLoaded = true
  const list = searchActions.removeHistoryWord(index)
  void saveSearchHistory(list)
}
export const clearHistoryList = () => {
  historyLoaded = true
  const list = searchActions.clearHistoryList()
  void saveSearchHistory(list)
}

