import kw from './kw'
import kg from './kg'
import tx from './tx'
import wy from './wy'
import mg from './mg'
// import bd from './bd'
import xm from './xm'
import { supportQuality } from './api-source'
import { rankMusicVersions } from '../musicVersionMatch'


const sources = {
  sources: [
    {
      name: '酷我音乐',
      id: 'kw',
    },
    {
      name: '酷狗音乐',
      id: 'kg',
    },
    {
      name: 'QQ音乐',
      id: 'tx',
    },
    {
      name: '网易音乐',
      id: 'wy',
    },
    {
      name: '咪咕音乐',
      id: 'mg',
    },
    // {
    //   name: '百度音乐',
    //   id: 'bd',
    // },
  ],
  kw,
  kg,
  tx,
  wy,
  mg,
  // bd,
  xm,
}
export default {
  ...sources,
  supportQuality,
}

export const init = () => {
  const tasks = []
  for (let source of sources.sources) {
    let sm = sources[source.id]
    sm && sm.init && tasks.push(sm.init())
  }
  return Promise.all(tasks)
}


export const searchMusic = async({ name, singer, source: s, limit = 25 }) => {
  const trimStr = str => typeof str == 'string' ? str.trim() : str
  const musicName = trimStr(name)
  const tasks = []
  const excludeSource = ['xm']
  for (const source of sources.sources) {
    if (!sources[source.id].musicSearch || source.id == s || excludeSource.includes(source.id)) continue
    tasks.push(sources[source.id].musicSearch.search(`${musicName} ${singer || ''}`.trim(), 1, limit).catch(_ => null))
  }
  return (await Promise.all(tasks)).filter(s => s)
}

export const findMusic = async(musicInfo) => {
  const lists = await searchMusic({ name: musicInfo.name, singer: musicInfo.singer, source: musicInfo.source, limit: 25 })
  const candidates = lists.flatMap(source => rankMusicVersions(musicInfo, Array.isArray(source.list) ? source.list : []).slice(0, 1))
  return rankMusicVersions(musicInfo, candidates)
}
