import { httpFetch } from '../../request'
import { formatPlayTime, sizeFormate } from '../../index'
import { formatSingerName } from '../utils'

export default {
  limit: 300,
  list: [
    {
      id: 'txlxzsb',
      name: '流行榜',
      bangid: 4,
    },
    {
      id: 'txrgb',
      name: '热歌榜',
      bangid: 26,
    },
    {
      id: 'txwlhgb',
      name: '网络榜',
      bangid: 28,
    },
    {
      id: 'txdyb',
      name: '抖音榜',
      bangid: 60,
    },
    {
      id: 'txndb',
      name: '内地榜',
      bangid: 5,
    },
    {
      id: 'txxgb',
      name: '香港榜',
      bangid: 59,
    },
    {
      id: 'txtwb',
      name: '台湾榜',
      bangid: 61,
    },
    {
      id: 'txoumb',
      name: '欧美榜',
      bangid: 3,
    },
    {
      id: 'txhgb',
      name: '韩国榜',
      bangid: 16,
    },
    {
      id: 'txrbb',
      name: '日本榜',
      bangid: 17,
    },
    {
      id: 'txtybb',
      name: 'YouTube榜',
      bangid: 128,
    },
  ],
  listDetailRequest(id, period, limit) {
    const data = {
      toplist: {
        module: 'musicToplist.ToplistInfoServer',
        method: 'GetDetail',
        param: { topid: id, num: limit, period },
      },
      comm: { uin: 0, format: 'json', ct: 24, cv: 0 },
    }
    return httpFetch(`https://u.y.qq.com/cgi-bin/musicu.fcg?data=${encodeURIComponent(JSON.stringify(data))}`, {
      headers: { Referer: 'https://y.qq.com/' },
    }).promise
  },
  regExps: {
    periodList: /<i class="play_cover__btn c_tx_link js_icon_play" data-listkey=".+?" data-listname=".+?" data-tid=".+?" data-date=".+?" .+?<\/i>/g,
    period: /data-listname="(.+?)" data-tid=".*?\/(.+?)" data-date="(.+?)" .+?<\/i>/,
  },
  periods: {},
  periodUrl: 'https://c.y.qq.com/node/pc/wk_v15/top.html',
  _requestBoardsObj: null,
  getBoardsData() {
    const data = { comm: { ct: 24, cv: 0 }, toplist: { module: 'musicToplist.ToplistInfoServer', method: 'GetAll', param: {} } }
    return httpFetch(`https://u.y.qq.com/cgi-bin/musicu.fcg?data=${encodeURIComponent(JSON.stringify(data))}`, {
      headers: { Referer: 'https://y.qq.com/' },
    }).promise
  },
  getData(url) {
    const requestDataObj = httpFetch(url)
    return requestDataObj.promise
  },
  filterData(rawList) {
    // console.log(rawList)
    return rawList.map(item => {
      let types = []
      let _types = {}
      if (item.file.size_128mp3 !== 0) {
        let size = sizeFormate(item.file.size_128mp3)
        types.push({ type: '128k', size })
        _types['128k'] = {
          size,
        }
      }
      if (item.file.size_320mp3 !== 0) {
        let size = sizeFormate(item.file.size_320mp3)
        types.push({ type: '320k', size })
        _types['320k'] = {
          size,
        }
      }
      if (item.file.size_flac !== 0) {
        let size = sizeFormate(item.file.size_flac)
        types.push({ type: 'flac', size })
        _types.flac = {
          size,
        }
      }
      if (item.file.size_hires !== 0) {
        let size = sizeFormate(item.file.size_hires)
        types.push({ type: 'flac24bit', size })
        _types.flac24bit = {
          size,
        }
      }
      // types.reverse()
      return {
        singer: formatSingerName(item.singer, 'name'),
        name: item.title,
        albumName: item.album.name,
        albumId: item.album.mid,
        source: 'tx',
        interval: formatPlayTime(item.interval),
        songId: item.id,
        albumMid: item.album.mid,
        strMediaMid: item.file.media_mid,
        songmid: item.mid,
        img: (item.album.name === '' || item.album.name === '空')
          ? item.singer?.length ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${item.singer[0].mid}.jpg` : ''
          : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${item.album.mid}.jpg`,
        lrc: null,
        otherSource: null,
        types,
        _types,
        typeUrl: {},
      }
    })
  },
  async getPeriods(bangid) {
    await this.getBoards()
    const period = this.periods[bangid]?.period
    if (!period) throw new Error('QQ音乐榜单期数不可用')
    return period
  },
  filterBoardsData(rawList) {
    // console.log(rawList)
    let list = []
    for (const board of rawList) {
      // 排除 MV榜
      if (board.id == 201) continue

      if (board.topTitle.startsWith('巅峰榜·')) {
        board.topTitle = board.topTitle.substring(4, board.topTitle.length)
      }
      if (!board.topTitle.endsWith('榜')) board.topTitle += '榜'
      list.push({
        id: 'tx__' + board.id,
        name: board.topTitle,
        bangid: String(board.id),
      })
    }
    return list
  },
  async getBoards() {
    const response = await this.getBoardsData()
    const groups = response.body?.toplist?.data?.group
    if (response.statusCode !== 200 || response.body.code !== 0 || response.body.toplist.code !== 0 || !Array.isArray(groups)) throw new Error('QQ音乐榜单同步失败')
    const items = groups.flatMap(group => group.toplist ?? []).filter(item => item.topId && item.period)
    const unique = [...new Map(items.map(item => [item.topId, item])).values()]
    if (!unique.length) throw new Error('QQ音乐返回了空榜单')
    this.periods = Object.fromEntries(unique.map(item => [item.topId, { period: item.period, name: item.title }]))
    this.list = unique.map(item => ({ id: `tx__${item.topId}`, name: item.title, bangid: String(item.topId) }))
    return { list: this.list, source: 'tx' }
  },
  getList(bangid, page, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    bangid = parseInt(bangid)
    let info = this.periods[bangid]
    let p = info ? Promise.resolve(info.period) : this.getPeriods(bangid)
    return p.then(period => {
      return this.listDetailRequest(bangid, period, this.limit).then(resp => {
        if (resp.body.code !== 0 || resp.body.toplist?.code !== 0 || !Array.isArray(resp.body.toplist?.data?.songInfoList)) return this.getList(bangid, page, retryNum)
        return {
          total: resp.body.toplist.data.songInfoList.length,
          list: this.filterData(resp.body.toplist.data.songInfoList),
          limit: this.limit,
          page: 1,
          source: 'tx',
        }
      })
    })
  },

  getDetailPageUrl(id) {
    if (typeof id == 'string') id = id.replace('tx__', '')
    return `https://y.qq.com/n/ryqq/toplist/${id}`
  },
}
