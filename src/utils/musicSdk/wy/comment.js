import { httpFetch } from '../../request'
import { dateFormat2 } from '../../index'

const emojis = [
  ['大笑', '😃'],
  ['可爱', '😊'],
  ['憨笑', '☺️'],
  ['色', '😍'],
  ['亲亲', '😙'],
  ['惊恐', '😱'],
  ['流泪', '😭'],
  ['亲', '😚'],
  ['呆', '😳'],
  ['哀伤', '😔'],
  ['呲牙', '😁'],
  ['吐舌', '😝'],
  ['撇嘴', '😒'],
  ['怒', '😡'],
  ['奸笑', '😏'],
  ['汗', '😓'],
  ['痛苦', '😖'],
  ['惶恐', '😰'],
  ['生病', '😨'],
  ['口罩', '😷'],
  ['大哭', '😂'],
  ['晕', '😵'],
  ['发怒', '👿'],
  ['开心', '😄'],
  ['鬼脸', '😜'],
  ['皱眉', '😞'],
  ['流感', '😢'],
  ['爱心', '❤️'],
  ['心碎', '💔'],
  ['钟情', '💘'],
  ['星星', '⭐️'],
  ['生气', '💢'],
  ['便便', '💩'],
  ['强', '👍'],
  ['弱', '👎'],
  ['拜', '🙏'],
  ['牵手', '👫'],
  ['跳舞', '👯‍♀️'],
  ['禁止', '🙅‍♀️'],
  ['这边', '💁‍♀️'],
  ['爱意', '💏'],
  ['示爱', '👩‍❤️‍👨'],
  ['嘴唇', '👄'],
  ['狗', '🐶'],
  ['猫', '🐱'],
  ['猪', '🐷'],
  ['兔子', '🐰'],
  ['小鸡', '🐤'],
  ['公鸡', '🐔'],
  ['幽灵', '👻'],
  ['圣诞', '🎅'],
  ['外星', '👽'],
  ['钻石', '💎'],
  ['礼物', '🎁'],
  ['男孩', '👦'],
  ['女孩', '👧'],
  ['蛋糕', '🎂'],
  ['18', '🔞'],
  ['圈', '⭕'],
  ['叉', '❌'],
]

const applyEmoji = text => {
  for (const e of emojis) text = text.replaceAll(`[${e[0]}]`, e[1])
  return text
}

export default {
  _requestObj: null,
  _requestObj2: null,
  async getComment({ songmid }, page = 1, limit = 20) {
    if (this._requestObj) this._requestObj.cancelHttp()

    const id = 'R_SO_4_' + songmid

    const _requestObj = httpFetch(`https://music.163.com/api/v1/resource/comments/${id}?limit=${limit}&offset=${(page - 1) * limit}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
        origin: 'https://music.163.com',
        Referer: 'https://music.163.com/',
      },
    })
    const { body, statusCode } = await _requestObj.promise
    // console.log(body)
    if (statusCode != 200 || body.code !== 200 || !Array.isArray(body.comments)) throw new Error('获取评论失败')
    return { source: 'wy', comments: this.filterComment(body.comments), total: body.total, page, limit, maxPage: Math.ceil(body.total / limit) || 1 }
  },
  async getHotComment({ songmid }, page = 1, limit = 100) {
    if (this._requestObj2) this._requestObj2.cancelHttp()

    const id = 'R_SO_4_' + songmid

    const _requestObj2 = httpFetch(`https://music.163.com/api/v1/resource/hotcomments/${id}?limit=${limit}&offset=${(page - 1) * limit}&beforeTime=0`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
        origin: 'https://music.163.com',
        Referer: 'https://music.163.com/',
      },
    })
    const { body, statusCode } = await _requestObj2.promise
    if (statusCode != 200 || body.code !== 200 || !Array.isArray(body.hotComments)) throw new Error('获取热门评论失败')
    const total = body.total ?? 0
    return { source: 'wy', comments: this.filterComment(body.hotComments), total, page, limit, maxPage: Math.ceil(total / limit) || 1 }
  },
  filterComment(rawList) {
    return rawList.map(item => {
      let data = {
        id: item.commentId,
        text: item.content ? applyEmoji(item.content) : '',
        time: item.time ? item.time : '',
        timeStr: item.time ? dateFormat2(item.time) : '',
        location: item.ipLocation?.location,
        userName: item.user.nickname,
        avatar: item.user.avatarUrl,
        userId: item.user.userId,
        likedCount: item.likedCount,
        reply: [],
      }

      let replyData = item.beReplied && item.beReplied[0]
      return replyData
        ? {
            id: item.commentId,
            rootId: replyData.beRepliedCommentId,
            text: replyData.content ? applyEmoji(replyData.content) : '',
            time: item.time,
            timeStr: null,
            location: replyData.ipLocation?.location,
            userName: replyData.user.nickname,
            avatar: replyData.user.avatarUrl,
            userId: replyData.user.userId,
            likedCount: null,
            reply: [data],
          }
        : data
    })
  },
}
