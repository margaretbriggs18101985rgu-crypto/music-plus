const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')
function metadata({ wy, response, matches = [] }) {
  const output = ts.transpileModule(fs.readFileSync('src/core/music/officialInfo.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const module = { exports: {} }
  new Function('module', 'exports', 'require', output)(module, module.exports, id => {
    if (id === '@/utils/request') return { httpFetch: url => ({ promise: Promise.resolve(response(url)) }) }
    if (id.endsWith('/musicInfo')) return { default: () => ({ promise: Promise.resolve(wy) }) }
    return { getOtherSource: async () => matches }
  })
  return module.exports.getOfficialSongInfo
}
test('NetEase information uses current official data even when local metadata is stale', async () => {
  const get = metadata({ wy: { id: 101, name: '官方标题', ar: [{ name: '官方歌手' }], al: { id: 202, name: '官方专辑' }, dt: 185000 },
    response: url => { assert.equal(new URL(url).hostname, 'music.163.com'); return { body: { code: 200, album: { publishTime: 1700000000000, company: '官方公司' } } } } })
  const info = await get({ source: 'wy', name: '旧标题', meta: { songId: 101 } })
  assert.equal(info.name, '官方标题')
  assert.equal(info.duration, '03:05')
  assert.equal(info.company, '官方公司')
  assert.match(info.url, /id=101$/)
})
test('QQ detail uses the matched official song ID and reports the source', async () => {
  const get = metadata({ matches: [{ source: 'tx', meta: { songId: 'MID123' } }], response: url => {
    assert.equal(new URL(url).hostname, 'u.y.qq.com')
    assert.equal(JSON.parse(new URL(url).searchParams.get('data')).req.param.song_mid, 'MID123')
    return { body: { code: 0, req: { code: 0, data: { track_info: { mid: 'MID123', title: 'QQ标题', singer: [{ name: '歌手' }], album: { name: '专辑' }, interval: 212 } } } } }
  } })
  const info = await get({ source: 'kw', meta: {} })
  assert.equal(info.source, 'QQ音乐')
  assert.equal(info.duration, '03:32')
})
test('no official match or a rejected official response does not create fabricated details', async () => {
  await assert.rejects(metadata({ response: () => ({ body: {} }) })({ source: 'local' }))
  await assert.rejects(metadata({ response: () => ({ body: { code: 500 } }) })({ source: 'tx', meta: { songId: 'MID' } }))
})
