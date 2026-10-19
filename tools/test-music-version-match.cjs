const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const { test } = require('node:test')
const exported = {}
const code = ts.transpileModule(fs.readFileSync('src/utils/musicVersionMatch.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
// eslint-disable-next-line no-new-func
new Function('exports', code)(exported)
const { musicVersionScore: score, rankMusicVersions: rank } = exported
const song = (name, singer = '周杰伦', albumName = '八度空间', interval = '05:19') => ({ name, singer, albumName, interval })

test('studio, live, cover and DJ versions cannot substitute for one another', () => {
  const versions = ['半岛铁盒', '半岛铁盒 (Live)', '半岛铁盒 (Cover)', '半岛铁盒 (DJ Remix)']
  for (const name of versions) {
    for (const candidate of versions) {
      assert.equal(score(song(name), song(candidate)) !== null, name === candidate, `${name} => ${candidate}`)
    }
  }
})

test('a cover artist mentioning the original singer cannot pass a substring match', () => {
  assert.equal(score(song('半岛铁盒'), song('半岛铁盒', '张三（原唱：周杰伦）')), null)
  assert.equal(score(song('半岛铁盒'), song('半岛铁盒', '周杰伦翻唱团')), null)
  assert.equal(score(song('半岛铁盒'), song('半岛铁盒', '周杰伦、张三')), null)
})

test('performer order and punctuation normalize while different artists remain distinct', () => {
  assert.notEqual(score(song('Song', 'Adele、Lady Gaga'), song('Song', 'lady gaga & ADELE')), null)
  assert.notEqual(score(song('Song', 'AC/DC'), song('Song', 'ac/dc')), null)
  assert.equal(score(song('Song', 'A'), song('Song', 'AB')), null)
  assert.equal(score(song('Song'), song('Song', '')), null)
})

test('concert and remixer qualifiers stay distinct, including DJ producer names', () => {
  assert.equal(score(song('Song (Live at Wembley 2016)'), song('Song (Live at Tokyo 2020)')), null)
  assert.equal(score(song('Song (Live at Wembley 2016)'), song('Song (Live)')), null)
  assert.equal(score(song('PZW (DJ小将 Remix)'), song('PZW (DJ张三 Remix)')), null)
  assert.notEqual(score(song('PZW (DJ小将 Remix)'), song('PZW（DJ小将 remix）')), null)
})

test('full-width version brackets remain safe when the Android engine omits normalize', () => {
  const sandbox = { exports: {} }
  vm.runInNewContext('String.prototype.normalize = undefined\n' + code, sandbox)
  const androidScore = sandbox.exports.musicVersionScore
  assert.notEqual(androidScore(song('PZW (DJ小将 Remix)'), song('PZW（ＤＪ小将 remix）')), null)
  assert.equal(androidScore(song('半岛铁盒'), song('半岛铁盒（Ｌｉｖｅ）')), null)
})

test('an album identifying a concert also prevents a studio substitution', () => {
  assert.equal(score(song('半岛铁盒'), song('半岛铁盒', '周杰伦', '周杰伦演唱会')), null)
  assert.notEqual(score(song('Song', 'DJ Snake'), song('Song', 'DJ Snake')), null)
  assert.equal(score(song('DJ Got Us Fallin In Love', 'Usher'), song('DJ Got Us Fallin In Love (Remix)', 'Usher')), null)
  assert.notEqual(score(song('Live Forever', 'Oasis'), song('Live Forever', 'Oasis')), null)
})

test('speed edits, instrumentals and unknown title qualifiers are not silently discarded', () => {
  for (const version of ['Slowed', 'Sped Up', 'Instrumental', 'Acoustic', 'Demo', 'Radio Edit', 'Extended', 'Part 2', '粤语版']) {
    assert.equal(score(song('Song'), song(`Song (${version})`)), null, version)
  }
  assert.notEqual(score(song('Song'), song('Song (Original Version)')), null)
  assert.equal(score(song('一个人'), song('一个人的夜')), null)
})

test('duration disagreement is rejected, missing duration does not defeat exact identity', () => {
  assert.equal(score(song('Song'), song('Song', '周杰伦', '八度空间', '05:30')), null)
  assert.notEqual(score(song('Song'), song('Song', '周杰伦', '八度空间', null)), null)
  const wrong = song('Song (Live)')
  const match = song('Song', '周杰伦', '八度空间', '05:20')
  assert.equal(rank(song('Song'), [wrong, song('Song', '翻唱歌手'), match])[0], match)
})

test('the real source search selects a later correct candidate without mutating search results', async() => {
  const wrong = song('半岛铁盒 (Live)')
  const correct = song('半岛铁盒')
  const list = [wrong, correct]
  const sdk = {}
  const source = { musicSearch: { search: async() => ({ list }) } }
  const javascript = ts.transpileModule(fs.readFileSync('src/utils/musicSdk/index.js', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  // eslint-disable-next-line no-new-func
  new Function('exports', 'require', javascript)(sdk, name => name === '../musicVersionMatch' ? exported : name === './api-source' ? {} : { default: source })
  const before = JSON.stringify(list)
  const result = await sdk.findMusic({ ...song('半岛铁盒'), source: 'tx' })
  assert.ok(result.length > 0)
  assert.ok(result.every(item => item === correct))
  assert.equal(JSON.stringify(list), before)
})
