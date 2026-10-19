const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')

function environment() {
  const env = { calls: [], stored: null, respond: null }
  env.restart = () => {
    const module = { exports: {} }
    const code = ts.transpileModule(fs.readFileSync('src/core/songlistDiscovery.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText
    new Function('module', 'exports', 'require', code)(module, module.exports, id => {
      if (id === './songlist') return { getList: async(source, tag, sort, page, refresh) => {
        env.calls.push({ source, tag, sort, page, refresh })
        if (env.respond) return env.respond(source, page)
        return { list: [{ id: `${source}-${page}` }], total: 90, limit: 30, page, source }
      } }
      if (id === '@/plugins/storage') return {
        getData: async() => env.stored && structuredClone(env.stored),
        saveData: async(key, value) => { env.stored = structuredClone(value) },
      }
      if (id === '@/utils/log') return { log: { warn() {} } }
      throw new Error(id)
    })
    return module.exports.createSonglistDiscovery()
  }
  env.pager = env.restart()
  return env
}

test('refresh gets a different source page, pagination stays contiguous and wraps at the end', async() => {
  const { pager, calls } = environment()
  const first = await pager.load('wy', '', 'hot', 1, true)
  const next = await pager.load('wy', '', 'hot', 1, true)
  assert.notDeepEqual(next.list, first.list)
  assert.equal(next.page, 1)
  assert.equal(next.total, 60)
  const more = await pager.load('wy', '', 'hot', 2)
  assert.equal(more.page, 2)
  assert.equal(more.total, 60)
  assert.equal(more.list[0].id, 'wy-3')
  await pager.load('wy', '', 'hot', 1, true)
  assert.deepEqual(calls.map(call => call.page), [1, 2, 3, 1])
  assert.deepEqual(calls.map(call => call.refresh), [true, true, false, true])
})

test('reopening the app resumes after the last shown batch', async() => {
  const env = environment()
  await env.pager.load('wy', '', 'hot', 1, true)
  await env.restart().load('wy', '', 'hot', 1, true)
  assert.deepEqual(env.calls.map(call => call.page), [1, 2])
})

test('platform, category and sort each keep independent cursors', async() => {
  const { pager, calls } = environment()
  await pager.load('wy', '', 'hot', 1)
  await pager.load('tx', '', '-1', 1)
  await pager.load('wy', '摇滚', 'hot', 1)
  await pager.load('wy', '', 'new', 1)
  await pager.load('wy', '', 'hot', 1)
  assert.deepEqual(calls.map(call => call.page), [1, 1, 1, 1, 2])
  assert.ok(calls.every(call => call.refresh))
})

test('failed refresh leaves the cursor unchanged so retry does not skip a batch', async() => {
  const env = environment()
  await env.pager.load('wy', '', 'hot', 1)
  env.respond = async() => { throw new Error('offline') }
  await assert.rejects(env.pager.load('wy', '', 'hot', 1, true), /offline/)
  env.respond = null
  const result = await env.pager.load('wy', '', 'hot', 1, true)
  assert.equal(result.list[0].id, 'wy-2')
  assert.deepEqual(env.calls.map(call => call.page), [1, 2, 2])
})

test('removed source pages fall back to a fresh first page', async() => {
  const env = environment()
  await env.pager.load('wy', '', 'hot', 1)
  env.respond = async(source, page) => ({ list: page == 1 ? [{ id: 'current' }] : [], total: 20, limit: 30, source, page })
  const result = await env.pager.load('wy', '', 'hot', 1, true)
  assert.equal(result.list[0].id, 'current')
  assert.equal(result.total, 20)
  assert.deepEqual(env.calls.map(call => call.page), [1, 2, 1])
})

test('a stale request or unmounted screen cannot overwrite a newer cursor', async() => {
  const env = environment()
  let finish
  env.respond = async(source, page) => new Promise(resolve => { finish = () => resolve({ list: [{ id: 'old' }], total: 90, limit: 30, source, page }) })
  const old = env.pager.load('wy', '', 'hot', 1)
  await new Promise(resolve => setImmediate(resolve))
  env.pager.cancel()
  env.respond = null
  await env.pager.load('tx', '', '-1', 1)
  finish()
  await old
  assert.ok(!Object.keys(env.stored).some(key => key.includes('wy')))
  await env.pager.load('wy', '', 'hot', 1)
  assert.equal(env.calls.at(-1).page, 1)
})
