const assert = require('node:assert/strict')
const fs = require('node:fs')
const { EventEmitter } = require('node:events')
const ts = require('typescript')
const { test } = require('node:test')

function load(file, dependencies, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(module, module.exports, id => {
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`)
    return dependencies[id]
  }, ...Object.values(globals))
  return module.exports
}

test('first launch enters the home flow without agreement or startup dialogs, and initializes links and updates once', async() => {
  const calls = []
  const dependencies = {
    '@/core/common': { initSetting: async() => ({ 'common.isAgreePact': false, 'common.apiSource': 'user-source' }) },
    '@/core/init/deeplink': {},
    './deeplink': { initDeeplink: async() => { calls.push('links') } },
    '@/core/version': { startAutoUpdateCheck: () => { calls.push('updates') } },
    '@/core/autoListSync': { startAutoListSync: () => { calls.push('autoLists') } },
    '@/core/apiSource': { setApiSource: source => { assert.equal(source, 'user-source') } },
    '@/store/common/action': { default: { setFontSize() {} } },
    '@/utils/bootLog': { bootLog() {} },
  }
  for (const name of ['@/plugins/player/service', './theme', './i18n', './userApi', './player', './dataInit', './sync', './common']) {
    dependencies[name] = { default: async() => { calls.push(name) } }
  }
  const init = load('src/core/init/index.ts', dependencies, { global: { lx: { fontSize: 16 } } }).default
  const home = await init()
  await home()
  await home()
  assert.equal(await init(), home)
  assert.equal(calls.filter(call => call == 'updates').length, 1)
  assert.equal(calls.filter(call => call == 'autoLists').length, 1)
  assert.equal(calls.filter(call => call == 'links').length, 1)
  assert.equal(calls.filter(call => call == './player').length, 1)
})

function lazyPage(id, currentId = 'nav_search') {
  const events = new EventEmitter()
  const frames = new Map()
  let nextFrame = 1
  const env = { visible: currentId == id }
  const hook = load('src/screens/Home/Vertical/useLazyPage.ts', {
    react: {
      useState: initial => [initial, value => { env.visible = value }],
      useEffect: effect => { env.cleanup = effect() },
    },
    '@/store/common/state': { default: { navActiveId: currentId } },
  }, {
    global: { state_event: events },
    requestAnimationFrame: fn => { const key = nextFrame++; frames.set(key, fn); return key },
    cancelAnimationFrame: key => frames.delete(key),
  }).useLazyPage
  hook(id)
  return { env, events, frames, flush: () => { for (const fn of frames.values()) fn(); frames.clear() } }
}

for (const id of ['nav_search', 'nav_songlist', 'nav_top', 'nav_love', 'nav_setting']) {
  test(`${id} removes every event subscription and pending frame on unmount`, () => {
    const { env, events, frames } = lazyPage(id)
    events.emit('navActiveIdUpdated', id)
    assert.equal(frames.size, 1)
    assert.equal(events.listenerCount('configUpdated'), 1)
    env.cleanup()
    assert.equal(frames.size, 0)
    assert.deepEqual(events.eventNames(), [])
  })
}

test('lazy pages refresh after relevant settings changes without hiding the settings page', () => {
  const page = lazyPage('nav_search')
  page.events.emit('navActiveIdUpdated', 'nav_setting')
  page.events.emit('configUpdated', ['list.isShowAlbumName'])
  assert.equal(page.env.visible, false)
  page.events.emit('navActiveIdUpdated', 'nav_search')
  page.flush()
  assert.equal(page.env.visible, true)
  page.events.emit('themeUpdated')
  assert.equal(page.env.visible, true)
  page.env.cleanup()
  const settings = lazyPage('nav_setting', 'nav_setting')
  settings.events.emit('languageChanged')
  assert.equal(settings.env.visible, true)
  settings.env.cleanup()
})

function searchPage(saved = { source: 'wy', type: 'music' }) {
  const env = { effects: [], loads: [], saved: [], timers: new Map(), tips: [] }
  const events = new EventEmitter()
  const components = Object.fromEntries(['./HeaderBar', './TipList', './List', './SearchTypeSelector'].map(id => [id, id]))
  let timerId = 1
  const jsx = (type, props) => ({ type, props })
  const page = load('src/screens/Home/Views/Search/index.tsx', {
    react: { useRef: current => ({ current }), useEffect: effect => { env.effects.push(effect) } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View' },
    ...Object.fromEntries(Object.entries(components).map(([id, component]) => [id, { default: component }])),
    '@/store/search/state': { default: { searchText: 'test song' } },
    '@/utils/data': { getSearchSetting: async() => saved, saveSearchSetting: async value => { env.saved.push(value) } },
    '@/utils/tools': { createStyle: value => value },
    '@/core/search/search': { addHistoryWord: async() => {} },
  }, {
    global: { app_event: events },
    setTimeout: fn => { const key = timerId++; env.timers.set(key, fn); return key },
    clearTimeout: key => env.timers.delete(key),
  }).default
  const nodes = []
  const walk = node => { if (!node || typeof node != 'object') return; nodes.push(node); for (const child of [node.props?.children].flat()) walk(child) }
  walk(page())
  const get = component => nodes.find(node => node.type == component).props
  env.header = get('./HeaderBar')
  env.header.ref.current = { setText() {}, blur() {} }
  get('./List').ref.current = { loadList: (...args) => env.loads.push(args) }
  get('./TipList').ref.current = { hide() {}, search: text => env.tips.push(text) }
  env.cleanup = env.effects[0]()
  env.events = events
  env.nodes = nodes
  env.settle = () => new Promise(resolve => setImmediate(resolve))
  return env
}

test('search removes the type tabs and delegates keywords to aggregated results', async() => {
  const env = searchPage()
  await env.settle()
  assert.deepEqual(env.loads.at(-1), ['test song', 'all', 'music'])
  assert.deepEqual(env.saved[0], { source: 'all' })
  assert.ok(!env.nodes.some(node => node.type == './SearchTypeSelector'))
  env.events.emit('searchTypeChanged', 'songlist')
  env.header.onSearch('next song')
  assert.deepEqual(env.loads.at(-1), ['next song', 'all', 'music'])
  env.cleanup()
  assert.deepEqual(env.events.eventNames(), [])
})

test('a previously saved playlist search cannot strand the page without type tabs', async() => {
  const env = searchPage({ source: 'wy', type: 'songlist' })
  await env.settle()
  assert.deepEqual(env.loads.at(-1), ['test song', 'all', 'music'])
  assert.deepEqual(env.saved.at(-1), { source: 'all' })
  env.cleanup()
})

test('search suggestions debounce rapid input and cancel pending work when leaving', async() => {
  const env = searchPage()
  await env.settle()
  env.header.onTipSearch('old')
  env.header.onTipSearch('new')
  assert.equal(env.timers.size, 1)
  for (const [key, fn] of env.timers) { env.timers.delete(key); fn() }
  assert.deepEqual(env.tips, ['new'])
  env.header.onTipSearch('cancelled')
  env.cleanup()
  assert.equal(env.timers.size, 0)
})
