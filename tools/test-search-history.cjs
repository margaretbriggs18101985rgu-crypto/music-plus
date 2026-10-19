const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')

function load(file, dependencies) {
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  new Function('module', 'exports', 'require', code)(module, module.exports, id => { // eslint-disable-line no-new-func
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`)
    return dependencies[id]
  })
  return module.exports
}

function historyStore(initial = [], read) {
  const state = { historyList: [] }
  const setting = { 'search.isShowHistorySearch': true }
  const saved = []
  let stored = [...initial]
  let reads = 0
  const actions = load('src/store/search/action.ts', { './state': { default: state } }).default
  const core = load('src/core/search/search.ts', {
    '@/store/search/state': { default: state },
    '@/store/search/action': { default: actions },
    '@/store/setting/state': { default: { setting } },
    '@/utils/data': {
      getSearchHistory: async() => { reads++; return read ? read() : [...stored] },
      saveSearchHistory: async list => { stored = [...list]; saved.push([...list]) },
    },
  })
  return { core, state, setting, saved, reads: () => reads, stored: () => stored }
}

test('history trims input, moves repeated searches to the front and keeps the most recent 15', async() => {
  const { core, stored, reads } = historyStore(['old'])
  for (let index = 0; index < 18; index++) await core.addHistoryWord(`  song ${index}  `)
  await core.addHistoryWord('song 5')
  await core.addHistoryWord('song 5')
  await core.addHistoryWord('   ')
  const list = await core.getSearchHistory()
  assert.equal(list.length, 15)
  assert.equal(list[0], 'song 5')
  assert.equal(new Set(list).size, 15)
  assert.ok(!list.includes('old'))
  assert.equal(reads(), 1)
  list.length = 0
  assert.equal((await core.getSearchHistory()).length, 15)
  assert.deepEqual(await historyStore(stored()).core.getSearchHistory(), stored())
})

test('disabled history does not record searches and keeps previously saved records', async() => {
  const env = historyStore(['saved'])
  env.setting['search.isShowHistorySearch'] = false
  await env.core.addHistoryWord('private')
  assert.equal(env.reads(), 0)
  assert.deepEqual(env.stored(), ['saved'])
  env.setting['search.isShowHistorySearch'] = true
  assert.deepEqual(await env.core.getSearchHistory(), ['saved'])
})

test('concurrent initial loads share one read; clearing during the read cannot restore old records', async() => {
  let finishRead
  const pending = new Promise(resolve => { finishRead = resolve })
  const env = historyStore([], () => pending)
  const first = env.core.getSearchHistory()
  const second = env.core.getSearchHistory()
  assert.equal(env.reads(), 1)
  env.core.clearHistoryList()
  finishRead(['old'])
  assert.deepEqual(await first, [])
  assert.deepEqual(await second, [])
  assert.deepEqual(env.stored(), [])
  assert.deepEqual(await env.core.getSearchHistory(), [])
})

test('turning history off while storage loads prevents recording an in-flight search', async() => {
  let finishRead
  const env = historyStore([], () => new Promise(resolve => { finishRead = resolve }))
  const add = env.core.addHistoryWord('private')
  env.setting['search.isShowHistorySearch'] = false
  finishRead(['saved'])
  await add
  assert.deepEqual(env.saved, [])
  assert.deepEqual(await env.core.getSearchHistory(), ['saved'])
})

test('removal and clear persist, and stale or invalid indices cannot delete another item', async() => {
  const env = historyStore(['new', 'old'])
  await env.core.getSearchHistory()
  env.core.removeHistoryWord(-1)
  env.core.removeHistoryWord(10)
  assert.deepEqual(env.saved, [])
  env.core.removeHistoryWord(0)
  assert.deepEqual(env.stored(), ['old'])
  env.core.clearHistoryList()
  assert.deepEqual(await historyStore(env.stored()).core.getSearchHistory(), [])
})
