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
      saveData: async(key, value) => { values.set(key, JSON.parse(JSON.stringify(value))) },
      removeData: async key => values.delete(key),
    },
    './migrateSetting': { default: () => { throw Error('Unneeded legacy migration') }, __esModule: true },
    '@/store/setting/state': { default: state, __esModule: true },
    './migrate': {},
    '@/utils/tools': {},
    '@/utils/pageAppearance': load('src/utils/pageAppearance.ts', {}),
  })
  return { settings, defaults, values, state }
}

test('retired agreement and unused preferences are dropped while valid saved preferences survive', async() => {
  for (const extra of [{}, Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`obsolete_${i}`, true]))]) {
    const f = settingsFixture({ version: '2.0', 'common.isAgreePact': false, 'list.isShowSource': false, 'list.isSaveScrollLocation': false, 'theme.lightId': 'old-light', 'theme.darkId': 'old-dark', 'player.volume': 0.3, ...extra })
    const { setting } = await f.settings.initSetting()
    assert.equal(setting['player.volume'], 0.3)
    for (const key of ['common.isAgreePact', 'list.isShowSource', 'list.isSaveScrollLocation', 'theme.lightId', 'theme.darkId', ...Object.keys(extra)]) {
      assert.equal(Object.hasOwn(setting, key), false)
    }
  }
})

test('old saved settings gain immersive defaults without changing existing preferences or schema version', async() => {
  const f = settingsFixture({ version: '2.0', 'player.volume': 0.3, 'player.isShowLyricTranslation': true, 'common.apiSource': 'user-choice' })
  const { setting } = await f.settings.initSetting()
  assert.equal(setting['player.immersiveVisualsEnabled'], true)
  assert.equal(setting['player.particleQuality'], 'auto')
  assert.equal(setting['player.lyricMotionEnabled'], true)
  assert.equal(setting['player.lyricPulseEnabled'], true)
  assert.equal(setting['player.lyricDisplayMode'], 'single')
  assert.equal(setting['player.lyricColor'], '#A8F6FF')
  assert.equal(setting['player.lyricFontFamily'], 'system')
  assert.equal(setting['player.backgroundMotion'], true)
  assert.equal(setting['player.respectReducedMotion'], true)
  assert.equal(setting['player.volume'], 0.3)
  assert.equal(setting['player.isShowLyricTranslation'], true)
  assert.equal(setting['common.apiSource'], 'user-choice')
  assert.equal(setting.version, '2.0')
  assert.deepEqual(f.values.get('@setting_v1'), setting)
})

test('disabled effects and an explicit particle selection survive the real settings merge and reload', async() => {
  const first = settingsFixture(null)
  first.state.setting = (await first.settings.initSetting()).setting
  const { setting, updatedSettingKeys } = first.settings.updateSetting({
    'player.immersiveVisualsEnabled': false,
    'player.particleQuality': 'low',
    'player.lyricMotionEnabled': false,
    'player.lyricPulseEnabled': false,
    'player.backgroundMotion': false,
    'player.respectReducedMotion': false,
    'player.lyricDisplayMode': 'multiple',
    'player.lyricColor': '#FF9FCF',
    'player.lyricFontFamily': 'wenkai',
  })
  assert.ok(updatedSettingKeys.includes('player.immersiveVisualsEnabled'))
  const second = settingsFixture(JSON.parse(JSON.stringify(setting)))
  assert.deepEqual((await second.settings.initSetting()).setting, setting)
  assert.equal(setting['player.particleQuality'], 'low')
  assert.equal(setting['player.lyricPulseEnabled'], false)
  assert.equal(setting['player.immersiveVisualsEnabled'], false)
  assert.equal(setting['player.lyricDisplayMode'], 'multiple')
  assert.equal(setting['player.lyricColor'], '#FF9FCF')
  assert.equal(setting['player.lyricFontFamily'], 'wenkai')
})

test('page typography persists independently of lyric typography and playback', async() => {
  const first = settingsFixture({ 'player.lyricFontFamily': 'xiaowei', 'player.lyricColor': '#FF9FCF', 'player.volume': 0.35 })
  first.state.setting = (await first.settings.initSetting()).setting
  const { setting } = first.settings.updateSetting({ 'theme.pageFontFamily': 'wenkai', 'theme.pageFontColor': '#abc' })
  assert.equal(setting['theme.pageFontColor'], '#AABBCC')
  const second = settingsFixture(structuredClone(setting))
  const restored = (await second.settings.initSetting()).setting
  assert.equal(restored['theme.pageFontFamily'], 'wenkai')
  assert.equal(restored['theme.pageFontColor'], '#AABBCC')
  assert.equal(restored['player.lyricFontFamily'], 'xiaowei')
  assert.equal(restored['player.lyricColor'], '#FF9FCF')
  assert.equal(restored['player.volume'], 0.35)
})

test('retired themes and auto theme settings cannot restore colored themes', async() => {
  for (const id of ['green', 'blue_plus', 'black', 'auto', 'user-custom', 'mineradio', 'white']) {
    const { setting } = await settingsFixture({ 'theme.id': id, 'common.isAutoTheme': true }).settings.initSetting()
    assert.equal(setting['theme.id'], id == 'white' ? 'white' : 'mineradio')
    assert.equal(setting['common.isAutoTheme'], false)
  }
})

test('invalid imported page appearance falls back without modifying lyric settings', async() => {
  const { setting } = await settingsFixture({ 'theme.pageFontFamily': 'missing', 'theme.pageFontColor': 'not-a-color', 'player.lyricFontFamily': 'huangyou' }).settings.initSetting()
  assert.equal(setting['theme.pageFontFamily'], 'system')
  assert.equal(setting['theme.pageFontColor'], '')
  assert.equal(setting['player.lyricFontFamily'], 'huangyou')
})

test('sequential page and lyric edits retain every unrelated selection', async() => {
  const f = settingsFixture({ 'theme.id': 'white' })
  f.state.setting = (await f.settings.initSetting()).setting
  for (const change of [{ 'theme.pageFontFamily': 'wenkai' }, { 'theme.pageFontColor': '#0045D1' }, { 'player.lyricColor': '#FF3330' }]) {
    f.state.setting = f.settings.updateSetting(change).setting
  }
  assert.equal(f.state.setting['theme.id'], 'white')
  assert.equal(f.state.setting['theme.pageFontFamily'], 'wenkai')
  assert.equal(f.state.setting['theme.pageFontColor'], '#0045D1')
  assert.equal(f.state.setting['player.lyricFontFamily'], 'system')
  assert.equal(f.state.setting['player.lyricColor'], '#FF3330')
  const restored = (await settingsFixture(structuredClone(f.state.setting)).settings.initSetting()).setting
  assert.deepEqual(restored, f.state.setting)
})

for (const font of ['system', 'wenkai', 'xiaowei', 'huangyou']) {
  test(`lyric font ${font} survives a settings reload without changing typography or playback preferences`, async() => {
    const first = settingsFixture({ version: '2.0', 'player.lyricFontSize': 36, 'player.lyricAlign': 'right', 'player.volume': 0.4 })
    first.state.setting = (await first.settings.initSetting()).setting
    const { setting } = first.settings.updateSetting({ 'player.lyricFontFamily': font })
    const second = settingsFixture(JSON.parse(JSON.stringify(setting)))
    const reloaded = (await second.settings.initSetting()).setting
    assert.equal(reloaded['player.lyricFontFamily'], font)
    assert.equal(reloaded['player.lyricFontSize'], 36)
    assert.equal(reloaded['player.lyricAlign'], 'right')
    assert.equal(reloaded['player.volume'], 0.4)
  })
}

test('reactive visual switches and sliders survive the actual settings save and reload independently of playback', async() => {
  const first = settingsFixture({ 'player.volume': 0.45, 'common.apiSource': 'saved-source' })
  first.state.setting = (await first.settings.initSetting()).setting
  assert.equal(first.state.setting['player.reactiveVisuals'], '{}')
  const selection = JSON.stringify({ intensity: 1.35, cinemaEnabled: false, spectrumEnabled: false, terrainEnabled: true, kickAuto: false, kickLowHz: 50, kickHighHz: 130 })
  const { setting } = first.settings.updateSetting({ 'player.reactiveVisuals': selection })
  const restored = (await settingsFixture(JSON.parse(JSON.stringify(setting))).settings.initSetting()).setting
  assert.equal(restored['player.reactiveVisuals'], selection)
  assert.equal(restored['player.volume'], 0.45)
  assert.equal(restored['common.apiSource'], 'saved-source')
})
