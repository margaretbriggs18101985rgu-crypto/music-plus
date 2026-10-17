const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')

// Run project storage/init code with a clean in-memory store. The third-party
// script is data throughout these tests; it is never executed in Node.
function fixture() {
  const values = new Map()
  const cache = new Map()
  const setting = { 'common.apiSource': '' }
  const updates = []
  let available = []
  const noop = () => {}
  const storage = {
    getData: async key => values.get(key) ?? null,
    saveData: async (key, value) => { values.set(key, value) },
    getAllKeys: async () => [...values.keys()],
    saveDataMultiple: async entries => { entries.forEach(([key, value]) => values.set(key, value)) },
    removeData: async key => { values.delete(key) },
    removeDataMultiple: async keys => { keys.forEach(key => values.delete(key)) },
    getDataMultiple: async keys => keys.map(key => [key, values.get(key)]),
  }
  const stubs = {
    '@/plugins/storage': storage,
    '@/utils/common': { throttle: callback => callback },
    '@/utils/nativeModules/userApi': { onScriptAction: noop, sendAction: noop },
    '@/core/userApi': { log: {}, setUserApiList: list => { available = list }, setUserApiStatus: noop },
    '@/store/setting/state': { default: { setting } },
    'react-native-background-timer': { default: {} },
    '@/utils/tools': { confirmDialog: noop, openUrl: noop, tipDialog: noop },
    '@/core/common': { updateSetting: patch => { updates.push(patch); Object.assign(setting, patch) } },
  }
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports
    if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'))
    const module = { exports: {} }
    cache.set(filename, module)
    const source = fs.readFileSync(filename, 'utf8')
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, resolveJsonModule: true } }).outputText
    function projectRequire(id) {
      const alias = id.startsWith('.') ? '@/' + path.relative(path.join(root, 'src'), path.resolve(path.dirname(filename), id)).replaceAll('\\', '/') : id
      if (Object.hasOwn(stubs, alias)) return stubs[alias]
      if (alias.endsWith('/request')) return { fetchData: noop }
      let target = alias.startsWith('@/') ? path.join(root, 'src', alias.slice(2)) : null
      assert.ok(target, `Unexpected dependency: ${id}`)
      if (!path.extname(target)) {
        target = fs.existsSync(target + '.ts') ? target + '.ts' : path.join(target, 'index.ts')
      }
      return load(target)
    }
    new Function('module', 'exports', 'require', output)(module, module.exports, projectRequire)
    return module.exports
  }
  return { load, values, setting, updates, getAvailable: () => available }
}

test('fresh storage exposes the pinned script without storing/downloading it', async () => {
  const f = fixture()
  const data = f.load(path.join(root, 'src/utils/data.ts'))
  const defaults = f.load(path.join(root, 'src/config/defaultSetting.ts')).default
  const list = await data.getUserApiList()
  assert.equal(list.length, 1)
  assert.equal(defaults['common.apiSource'], list[0].id)
  assert.equal(list[0].version, '2.3.4')
  const script = await data.getUserApiScript(list[0].id)
  assert.equal(createHash('sha256').update(script).digest('hex'), '328e06c473dfc0ba6de338a7b04f00e3b67a69f59205ca6903d553a80b57c706')
  assert.equal(f.values.size, 0)
  assert.match(fs.readFileSync(path.join(root, 'android/app/src/main/assets/licenses/molanyinyueyuan-MIT.txt'), 'utf8'), /Copyright \(c\) 2026 baiji6/)
})

test('import, export and removal preserve imported scripts and the built-in entry', async () => {
  const f = fixture()
  const data = f.load(path.join(root, 'src/utils/data.ts'))
  const builtin = (await data.getUserApiList())[0]
  const script = '/*!\n * @name Local contract fixture\n * @version 1.0.0\n */\n'
  const imported = await data.addUserApi(script)
  assert.equal((await data.getUserApiList()).length, 2)
  assert.equal(await data.getUserApiScript(imported.id), script)
  assert.equal((await data.getUserApiList()).filter(item => item.id === builtin.id).length, 1)
  const afterRemoval = await data.removeUserApi([imported.id])
  assert.deepEqual(afterRemoval.map(item => item.id), [builtin.id])
  assert.equal(await data.getUserApiScript(imported.id), '')
  assert.ok((await data.getUserApiScript(builtin.id)).length > 100000)
})

test('startup seeds an unset source and preserves an existing selection', async () => {
  const fresh = fixture()
  const init = fresh.load(path.join(root, 'src/core/init/userApi/index.ts')).default
  await init(fresh.setting)
  assert.equal(fresh.setting['common.apiSource'], 'user_api_builtin_molan')
  assert.equal(fresh.getAvailable()[0].id, 'user_api_builtin_molan')
  assert.equal(fresh.updates.length, 1)
  const existing = fixture()
  existing.setting['common.apiSource'] = 'user_api_existing_choice'
  await existing.load(path.join(root, 'src/core/init/userApi/index.ts')).default(existing.setting)
  assert.equal(existing.setting['common.apiSource'], 'user_api_existing_choice')
  assert.equal(existing.updates.length, 0)
})
