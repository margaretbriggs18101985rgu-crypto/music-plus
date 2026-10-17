const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')

function sdk(source, respond) {
  const code = fs.readFileSync(`src/utils/musicSdk/${source}/leaderboard.js`, 'utf8')
  const output = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const module = { exports: {} }
  const calls = []
  const request = { httpFetch(url, options) { calls.push({ url, options }); return { promise: Promise.resolve(respond(url, options)), cancelHttp() {} } } }
  new Function('module', 'exports', 'require', output)(module, module.exports, id => {
    if (id === '../../request') return request
    if (id === './utils/crypto') return { weapi: value => value }
    if (id === './musicDetail') return { default: { getList: async ids => ({ list: ids }) } }
    return { formatPlayTime: String, sizeFormate: String, formatSingerName: singers => singers.map(item => item.name).join('、') }
  })
  return { api: module.exports.default, calls }
}

test('QQ reads the official live catalog and uses its current period for detail', async () => {
  let period = '2026-10-17'
  const { api, calls } = sdk('tx', url => {
    const data = JSON.parse(new URL(url).searchParams.get('data'))
    assert.equal(new URL(url).hostname, 'u.y.qq.com')
    if (data.toplist.method === 'GetAll') return { statusCode: 200, body: { code: 0, toplist: { code: 0, data: { group: [{ toplist: [{ topId: 999, period, title: '官方新增榜单' }] }] } } } }
    assert.equal(data.toplist.param.period, period)
    return { statusCode: 200, body: { code: 0, toplist: { code: 0, data: { songInfoList: [] } } } }
  })
  assert.equal((await api.getBoards()).list[0].id, 'tx__999')
  await api.getList('999', 1)
  period = '2026-10-18'
  await api.getBoards()
  await api.getList('999', 1)
  assert.equal(calls.length, 4)
})

test('NetEase catalog changes are fetched rather than replaced with bundled IDs', async () => {
  let id = 70001
  const { api, calls } = sdk('wy', () => ({ statusCode: 200, body: { code: 200, list: [{ id, name: '官方榜单' }] } }))
  assert.equal((await api.getBoards()).list[0].id, 'wy__70001')
  id = 70002
  assert.equal((await api.getBoards()).list[0].id, 'wy__70002')
  assert.equal(calls.length, 2)
  assert.equal(new URL(calls[0].url).hostname, 'music.163.com')
})

test('failed and empty official responses are reported, without fake fallback results', async () => {
  await assert.rejects(sdk('wy', () => ({ statusCode: 200, body: { code: 200, list: [] } })).api.getBoards())
  await assert.rejects(sdk('tx', () => ({ statusCode: 503, body: {} })).api.getBoards())
})
