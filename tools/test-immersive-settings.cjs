const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')

function settingsFixture(saved) {
  const values = new Map([['@setting_v1', saved]])
  const state = { setting: {} }
  const load = (filename, dependencies) => {
    const module = { exports: {} }
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
    new Function('module', 'exports', 'require', code)(module, module.exports, id => { // eslint-disable-line no-new-func
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency ${id}`)
      return dependencies[id]
    })
    return module.exports
  }
  const defaults = load('src/config/defaultSetting.ts', { './builtinUserApi': { BUILTIN_USER_API_ID: 'existing-source' } }).default
  const settings = load('src/config/setting.ts', {
    '@/config/constant': { storageDataPrefix: { setting: '@setting_v1' }, storageDataPrefixOld: { setting: '@setting' } },
    '@/config/defaultSetting': { default: defaults, __esModule: true },
    '@/plugins/storage': {
      getData: async key => values.get(key) ?? null,
      saveData: async (key, value) => { values.set(key, JSON.parse(JSON.stringify(value))) },
      removeData: async key => values.delete(key),
    },
    './migrateSetting': { default: () => { throw Error('Unneeded legacy migration') }, __esModule: true },
    '@/store/setting/state': { default: state, __esModule: true },
    './migrate': {},
    '@/utils/tools': {},
  })
  return { settings, defaults, values, state }
}

test('old saved settings gain immersive defaults without changing existing preferences or schema version', async () => {
  const f = settingsFixture({ version: '2.0', 'player.volume': 0.3, 'player.isShowLyricTranslation': true, 'common.apiSource': 'user-choice' })
  const { setting } = await f.settings.initSetting()
  assert.equal(setting['player.immersiveVisualsEnabled'], true)
  assert.equal(setting['player.particleQuality'], 'auto')
  assert.equal(setting['player.lyricMotionEnabled'], true)
  assert.equal(setting['player.lyricDisplayMode'], 'single')
  assert.equal(setting['player.lyricColor'], '#A8F6FF')
  assert.equal(setting['player.backgroundMotion'], true)
  assert.equal(setting['player.respectReducedMotion'], true)
  assert.equal(setting['player.volume'], 0.3)
  assert.equal(setting['player.isShowLyricTranslation'], true)
  assert.equal(setting['common.apiSource'], 'user-choice')
  assert.equal(setting.version, '2.0')
  assert.deepEqual(f.values.get('@setting_v1'), setting)
})

test('disabled effects and an explicit particle selection survive the real settings merge and reload', async () => {
  const first = settingsFixture(null)
  first.state.setting = (await first.settings.initSetting()).setting
  const { setting, updatedSettingKeys } = first.settings.updateSetting({
    'player.immersiveVisualsEnabled': false, 'player.particleQuality': 'low',
    'player.lyricMotionEnabled': false, 'player.backgroundMotion': false, 'player.respectReducedMotion': false,
    'player.lyricDisplayMode': 'multiple', 'player.lyricColor': '#FF9FCF',
  })
  assert.ok(updatedSettingKeys.includes('player.immersiveVisualsEnabled'))
  const second = settingsFixture(JSON.parse(JSON.stringify(setting)))
  assert.deepEqual((await second.settings.initSetting()).setting, setting)
  assert.equal(setting['player.particleQuality'], 'low')
  assert.equal(setting['player.immersiveVisualsEnabled'], false)
  assert.equal(setting['player.lyricDisplayMode'], 'multiple')
  assert.equal(setting['player.lyricColor'], '#FF9FCF')
})
