const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')
const exportsForTest = {}
const code = ts.transpileModule(fs.readFileSync('src/utils/lyricWords.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
// eslint-disable-next-line no-new-func
new Function('exports', code)(exportsForTest)
const { matchLyricWords } = exportsForTest

test('real LX relative word times retain pauses and syllable durations', () => {
  const lines = [{ time: 10000, text: '铁盒的钥匙我找不到' }]
  const [words] = matchLyricWords(lines, '[00:10.000]<0,300>铁<300,400>盒<1000,500>的钥匙<2500,300>我找不到')
  assert.deepEqual(words, [
    { start: 0, end: 1, startTime: 10000, endTime: 10300 },
    { start: 1, end: 2, startTime: 10300, endTime: 10700 },
    { start: 2, end: 5, startTime: 11000, endTime: 11500 },
    { start: 5, end: 9, startTime: 12500, endTime: 12800 },
  ])
})

test('trimmed spaces and emoji keep the same UTF-16 character indices as Compose', () => {
  const [words] = matchLyricWords([{ time: 1250, text: '你🎵 好' }], '[00:01.250]<0,100>  你<100,200>🎵 <300,300>好  ')
  assert.deepEqual(words.map(word => [word.start, word.end]), [[0, 1], [1, 4], [4, 5]])
})

test('different song versions and malformed word times never attach incorrect timing', () => {
  const lines = [{ time: 1000, text: 'live version' }, { time: 2000, text: 'bad' }]
  assert.deepEqual(matchLyricWords(lines, '[00:01.000]<0,300>studio version\n[00:02.000]<0,0>bad'), [[], []])
  assert.deepEqual(matchLyricWords([{ time: 1000, text: 'ab' }], '[00:01.000]<100,400>a<200,300>b'), [[]])
})

test('plain LRC leaves word timing absent and multiple display lines retain their identities', () => {
  const lines = [{ time: 1000, text: 'a' }, { time: 2000, text: 'b' }, { time: 1000, text: 'other version' }]
  assert.deepEqual(matchLyricWords(lines, '[00:01.000]<0,100>a\n[00:02.000]b').map(words => words.length), [1, 0, 0])
  assert.deepEqual(matchLyricWords(lines), [[], [], []])
})

test('the embedded lyric offset applies to word times without changing displayed line identity', () => {
  const [words] = matchLyricWords([{ time: 1000, text: 'a' }], '[offset:200]\n[00:01.000]<0,500>a')
  assert.deepEqual(words, [{ start: 0, end: 1, startTime: 800, endTime: 1300 }])
})
