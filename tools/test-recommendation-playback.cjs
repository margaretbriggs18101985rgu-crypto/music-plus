const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')

const playCalls = []
let queued
const compiledModule = { exports: {} }
const code = ts.transpileModule(fs.readFileSync('src/core/music/recommendationPlayback.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
// eslint-disable-next-line no-new-func
new Function('module', 'exports', 'require', code)(compiledModule, compiledModule.exports, id => {
  if (id === '@/config/constant') return { LIST_IDS: { TEMP: 'temp' } }
  if (id === '@/core/list') return { setTempList: async(id, list) => { queued = { id, list }; playCalls.push('queue') } }
  if (id === '@/core/player/player') return { playList: async(id, index) => { playCalls.push(['play', id, index]) } }
  if (id === './recommendation') return { MAX_RECOMMENDED_SONGS: 20 }
  throw new Error(`Unexpected import: ${id}`)
})

test('play all queues the current twenty online recommendations in order and starts at the first track', async() => {
  const recommendations = Array.from({ length: 22 }, (_, index) => ({ id: `track-${index}`, name: `Track ${index}`, singer: `Artist ${index}`, source: 'wy' }))
  const played = await compiledModule.exports.playRecommendedSongs(recommendations)
  assert.equal(played, true)
  assert.equal(queued.id, 'recommendations')
  assert.deepEqual(queued.list.map(item => item.id), recommendations.slice(0, 20).map(item => item.id))
  assert.deepEqual(playCalls, ['queue', ['play', 'temp', 0]])
})

test('play all leaves the current queue untouched when there are no online recommendations', async() => {
  queued = undefined
  playCalls.length = 0
  const played = await compiledModule.exports.playRecommendedSongs([{ id: 'local', source: 'local' }])
  assert.equal(played, false)
  assert.equal(queued, undefined)
  assert.deepEqual(playCalls, [])
})
