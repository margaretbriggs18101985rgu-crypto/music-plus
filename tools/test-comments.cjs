const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')
function sdk(source, respond) {
  const module = { exports: {} }
  const calls = []
  const code = ts.transpileModule(fs.readFileSync(`src/utils/musicSdk/${source}/comment.js`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  new Function('module', 'exports', 'require', code)(module, module.exports, id => {
    if (id === '../../request') return { httpFetch(url, options) { calls.push({ url, options }); return { promise: Promise.resolve(respond(url, options)), cancelHttp() {} } } }
    if (id === './musicInfo') return { default: async () => ({ songId: 987 }) }
    return { dateFormat2: String }
  })
  return { api: module.exports.default, calls }
}
test('NetEase comments use the official song ID and page offset with real author/reply data', async () => {
  const item = { commentId: 42, content: '公开评论', time: 1700000000, user: { nickname: '评论作者', avatarUrl: 'https://example.com/avatar', userId: 1 }, likedCount: 9, beReplied: [] }
  const { api, calls } = sdk('wy', url => ({ statusCode: 200, body: { code: 200, total: 100, ...(url.includes('/hotcomments/') ? { hotComments: [item] } : { comments: [item] }) } }))
  assert.equal((await api.getHotComment({ songmid: '287035' }, 2, 20)).comments[0].userName, '评论作者')
  assert.equal((await api.getComment({ songmid: '287035' }, 3, 20)).comments[0].likedCount, 9)
  assert.equal(new URL(calls[0].url).hostname, 'music.163.com')
  assert.equal(new URL(calls[0].url).searchParams.get('offset'), '20')
  assert.equal(new URL(calls[1].url).searchParams.get('offset'), '40')
  assert.match(calls[1].url, /R_SO_4_287035/)
})
test('QQ hot/new comments keep QQ IDs and use official HTTPS endpoints', async () => {
  const { api, calls } = sdk('tx', () => ({ statusCode: 200, body: { code: 0, comment: { commentlist: [], commenttotal: 0 }, req: { code: 0, data: { CommentList: { Comments: [], Total: 0 } } } } }))
  await api.getComment({ songId: 97773 }, 2, 20)
  await api.getHotComment({ songId: 97773 }, 1, 20)
  assert.equal(new URL(calls[0].url).hostname, 'c.y.qq.com')
  assert.equal(new URL(calls[0].url).protocol, 'https:')
  assert.equal(calls[0].options.form.topid, 97773)
  assert.equal(calls[0].options.form.pagenum, 1)
  assert.equal(calls[1].options.body.req.param.BizId, '97773')
  assert.equal(calls[1].options.body.req.module, 'music.globalComment.CommentRead')
})
test('QQ comment paging treats zero totals with a full page as unknown and allows another page', async () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({
    rootcommentid: index + 1,
    commentid: index + 1,
    rootcommentcontent: `公开评论 ${index + 1}`,
    rootcommentnick: '评论作者',
    avatarurl: '',
    praisenum: 0,
    time: 1700000000,
  }))
  const { api } = sdk('tx', () => ({ statusCode: 200, body: { code: 0, comment: { commentlist: rows, commenttotal: 0 } } }))
  const response = await api.getComment({ songId: 97773 }, 1, 20)
  assert.equal(response.total, null)
  assert.equal(response.maxPage, 2)
  assert.equal(response.comments.length, 20)
})
test('official comment failures are surfaced instead of invented comments', async () => {
  await assert.rejects(sdk('wy', () => ({ statusCode: 200, body: { code: 301 } })).api.getComment({ songmid: 1 }))
  await assert.rejects(sdk('tx', () => ({ statusCode: 403, body: {} })).api.getHotComment({ songId: 2 }))
})
