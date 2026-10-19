const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')
const exported = {}
const code = ts.transpileModule(fs.readFileSync('src/core/player/sourceReliability.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
// eslint-disable-next-line no-new-func
new Function('exports', 'require', 'console', code)(exported, () => ({ getData: async() => null, saveData: async() => {} }), { warn() {} })
const { createSourceReliability, SOURCE_COOLDOWN_MS, SOURCE_HISTORY_MS } = exported
const song = source => ({ source, id: source, name: 'Song', singer: 'Artist', meta: { albumName: '' } })
async function fixture() {
  const f = { now: 1000000000, saved: null }
  const make = () => createSourceReliability({ now: () => f.now, load: async() => structuredClone(f.saved), save: async data => { f.saved = structuredClone(data) } })
  f.health = make()
  f.reload = async() => { await f.health.flush(); f.health = make(); await f.health.ready() }
  await f.health.ready()
  return f
}

test('one song blocks only itself; three distinct failed tracks temporarily quarantine a source', async() => {
  const f = await fixture(); const h = f.health
  h.failure('api', 'one', 'tx'); h.failure('api', 'one', 'tx'); h.failure('api', 'one', 'tx')
  assert.equal(h.blockedTrack('api', 'one', 'tx'), true)
  assert.equal(h.blockedSource('api', 'tx'), false)
  h.failure('api', 'two', 'tx'); h.failure('api', 'three', 'tx')
  assert.equal(h.blockedSource('api', 'tx'), true)
  assert.equal(h.blockedSource('other-api', 'tx'), false)
  assert.equal(h.blockedSource('api', 'kw'), false)
  f.now += SOURCE_COOLDOWN_MS + 1
  assert.equal(h.blockedSource('api', 'tx'), false)
})

test('successful playback clears the streak and remembers the exact candidate across restart', async() => {
  const f = await fixture(); const h = f.health
  h.failure('api', 'one', 'kw'); h.failure('api', 'two', 'kw')
  h.success('api', 'one', song('kw'))
  h.failure('api', 'three', 'kw')
  assert.equal(h.blockedSource('api', 'kw'), false)
  assert.equal(h.blockedTrack('api', 'one', 'kw'), false)
  assert.equal(h.preferred('api', 'one').source, 'kw')
  await f.reload()
  assert.equal(f.health.preferred('api', 'one').id, 'kw')
  assert.equal(f.health.remembered('api', 'one'), undefined)
  assert.deepEqual(f.health.sort('api', 'one', [song('tx'), song('kw')]).map(info => info.source), ['kw', 'tx'])
  assert.equal(JSON.stringify(f.saved).includes('http'), false)
})

test('different manual choices for one underlying song cannot quarantine a platform', async() => {
  const f = await fixture()
  for (const choice of ['live', 'cover', 'dj']) f.health.failure('api', choice, 'tx', 'same-song')
  assert.equal(f.health.blockedSource('api', 'tx'), false)
  assert.equal(f.health.blockedTrack('api', 'dj', 'tx'), true)
})

test('recent successes expire and persisted history stays bounded', async() => {
  const f = await fixture()
  for (let i = 0; i < 160; i++) f.health.success('api', String(i), song('kw'))
  await f.health.flush()
  assert.ok(f.saved.tracks.length <= 128)
  f.now += SOURCE_HISTORY_MS + 1
  assert.equal(f.health.preferred('api', '159'), undefined)
  assert.equal(f.health.remembered('api', '159'), undefined)
})

test('malformed/future timestamps cannot permanently blacklist a source', async() => {
  const health = createSourceReliability({
    now: () => 1000000,
    save: async() => {},
    load: async() => ({
      version: 1,
      sources: [{ api: 'api', source: 'tx', successAt: 0, failures: [], until: Number.MAX_SAFE_INTEGER }, { api: 'api', source: 'fake', successAt: 0 }],
      tracks: [{ api: 'api', track: 'song', source: 'tx', id: 'tx', successAt: Infinity, failures: [] }],
    }),
  })
  await health.ready()
  assert.equal(health.blockedSource('api', 'tx'), false)
  assert.equal(health.preferred('api', 'song'), undefined)
})

test('late storage completion cannot overwrite new in-memory successes', async() => {
  const pending = Promise.withResolvers()
  const health = createSourceReliability({ now: () => 1000000, save: async() => {}, load: () => pending.promise })
  const ready = health.ready()
  health.success('api', 'song', song('kw'))
  pending.resolve({ version: 1, sources: [], tracks: [{ api: 'api', track: 'song', source: 'tx', id: 'old', successAt: 900000, failures: [] }] })
  await ready
  assert.equal(health.preferred('api', 'song').source, 'kw')
})

test('storage failures leave playback history usable in memory', async() => {
  const health = createSourceReliability({ now: () => 1000000, load: async() => { throw Error('disk unavailable') }, save: async() => { throw Error('disk unavailable') } })
  await health.ready()
  health.success('api', 'song', song('kw'))
  await health.flush()
  assert.equal(health.preferred('api', 'song').source, 'kw')
})
