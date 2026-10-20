const assert = require('node:assert/strict')
const fs = require('node:fs')
const { EventEmitter } = require('node:events')
const { test } = require('node:test')
const ts = require('typescript')

const load = (file, dependencies) => {
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('module', 'exports', 'require', code)(module, module.exports, id => { // eslint-disable-line no-new-func
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency ${id}`)
    return dependencies[id]
  })
  return module.exports
}
const exported = value => ({ default: value, __esModule: true })

function fixture(enabled = true) {
  const stateEvents = new EventEmitter()
  const appEvents = new EventEmitter()
  global.state_event = stateEvents
  global.app_event = appEvents
  const states = []
  const switches = []
  const player = {
    musicInfo: { id: 'a', name: 'Track A', singer: 'Artist', pic: '/cover.jpg', lxlrc: '' },
    playMusicInfo: { musicInfo: { id: 'a' } },
    progress: { nowPlayTime: 10, maxPlayTime: 180 },
    statusText: '',
  }
  const defaults = load('src/config/defaultSetting.ts', { './builtinUserApi': { BUILTIN_USER_API_ID: 'source' } }).default
  const setting = { setting: { ...defaults, 'player.lockScreenLyrics': enabled } }
  let onSet, onPlay, onState, resolveState
  let removed = false
  const init = load('src/core/lockScreen.ts', {
    'react-native': { NativeModules: { LockScreenLyrics: { setEnabled: value => switches.push(value), updatePlayer: value => states.push(structuredClone(value)) } } },
    'react-native-track-player': {
      ...exported({
        getState: () => new Promise(resolve => { resolveState = resolve }),
        addEventListener: (_event, callback) => { onState = callback; return { remove: () => { removed = true } } },
      }),
      Event: { PlaybackState: 'playback-state' },
      State: { None: 'none', Playing: 'playing', Paused: 'paused', Buffering: 'buffering', Stopped: 'stopped' },
    },
    '@/store/player/state': exported(player),
    '@/store/setting/state': exported(setting),
    '@/plugins/lyric': { subscribeLyrics: (set, play) => { onSet = set; onPlay = play; set([]); play(-1); return () => { onSet = onPlay = () => {} } } },
    '@/components/common/Image': { defaultHeaders: { 'User-Agent': 'music-plus' } },
    '@/utils/lyricWords': { matchLyricWords: lines => lines.map(() => []) },
    '@/utils/reactiveVisuals': { parseReactiveVisuals: JSON.parse },
  }).default
  const cleanup = init()
  return {
    states,
    switches,
    player,
    setting,
    stateEvents,
    appEvents,
    cleanup,
    set: value => onSet(value),
    line: value => onPlay(value),
    playback: value => onState({ state: value }),
    resolveState: value => resolveState(value),
    removed: () => removed,
  }
}

test('new installation keeps lock screen opt-in', () => {
  const f = fixture(false)
  f.playback('playing')
  f.stateEvents.emit('playProgressChanged')
  assert.deepEqual(f.switches, [false])
  assert.equal(f.states.length, 0)
  f.cleanup()
})

test('background bridge sends real lyric lines, progress, seek and buffering without mounting a player view', async() => {
  const f = fixture()
  f.playback('playing')
  f.set([{ time: 1000, text: 'Original test lyric', extendedLyrics: ['Translation'] }])
  f.line(0)
  f.player.progress.nowPlayTime = 14.25
  f.stateEvents.emit('playProgressChanged')
  f.appEvents.emit('seekCompleted', 14.25)
  const current = f.states.at(-1)
  assert.equal(current.artwork, 'file:///cover.jpg')
  assert.equal(current.isPlaying, true)
  assert.equal(current.position, 14.25)
  assert.equal(current.seekRevision, 1)
  assert.equal(current.activeLyric, 0)
  assert.deepEqual(current.lyrics[0], { time: 1000, text: 'Original test lyric', translation: 'Translation', words: [] })
  // A delayed initial native read must not overwrite a newer playback event.
  f.resolveState('paused')
  await Promise.resolve()
  assert.equal(f.states.at(-1).isPlaying, true)
  f.playback('buffering')
  assert.equal(f.states.at(-1).isPlaying, false)
  f.playback('paused')
  assert.equal(f.states.at(-1).isPlaying, false)
  f.cleanup()
})

test('track switches clear stale lyrics and disable immediately stops bridge traffic', () => {
  const f = fixture()
  f.playback('playing')
  f.set([{ time: 0, text: 'Old song', extendedLyrics: [] }])
  f.player.musicInfo.id = 'b'
  f.stateEvents.emit('playMusicInfoChanged')
  assert.equal(f.states.at(-1).trackId, 'b')
  assert.deepEqual(f.states.at(-1).lyrics, [])
  assert.equal(f.states.at(-1).activeLyric, -1)
  f.setting.setting['player.lockScreenLyrics'] = false
  f.stateEvents.emit('configUpdated', ['player.lockScreenLyrics'])
  assert.equal(f.switches.at(-1), false)
  const count = f.states.length
  f.stateEvents.emit('playProgressChanged')
  f.line(1)
  assert.equal(f.states.length, count)
  f.cleanup()
  assert.equal(f.removed(), true)
  assert.equal(f.stateEvents.eventNames().length, 0)
  assert.equal(f.appEvents.eventNames().length, 0)
})

test('lock screen follows player star settings, including live quality and effect changes', () => {
  const f = fixture()
  f.playback('playing')
  for (const quality of ['off', 'low', 'high', 'auto']) {
    f.setting.setting['player.particleQuality'] = quality
    f.stateEvents.emit('configUpdated', ['player.particleQuality'])
    assert.equal(f.states.at(-1).particleQuality, quality)
  }
  const fx = { particleSize: 1.8, speed: 0.5, starRiver: false, terrainEnabled: true, spectrumEnabled: true }
  Object.assign(f.setting.setting, {
    'player.immersiveVisualsEnabled': false,
    'player.starPulseEnabled': false,
    'player.backgroundMotion': false,
    'player.respectReducedMotion': false,
    'player.reactiveVisuals': JSON.stringify(fx),
  })
  f.stateEvents.emit('configUpdated', ['player.reactiveVisuals', 'player.immersiveVisualsEnabled', 'player.starPulseEnabled', 'player.backgroundMotion', 'player.respectReducedMotion'])
  const current = f.states.at(-1)
  assert.deepEqual(current.reactiveVisuals, fx)
  for (const key of ['immersiveVisualsEnabled', 'starPulseEnabled', 'backgroundMotion', 'respectReducedMotion']) assert.equal(current[key], false)
  f.cleanup()
})

test('lock screen wallpaper stays independent of app wallpaper and clears back to stars', () => {
  const f = fixture()
  Object.assign(f.setting.setting, {
    'theme.wallpaper.path': '/app-background.jpg',
    'theme.wallpaper.kind': 'image',
    'theme.wallpaper.scope': 'pages',
    'player.lockScreenWallpaper.path': '/lock-background.mp4',
    'player.lockScreenWallpaper.kind': 'video',
  })
  f.stateEvents.emit('configUpdated', ['player.lockScreenWallpaper.path', 'player.lockScreenWallpaper.kind'])
  assert.equal(f.states.at(-1).wallpaperPath, '/lock-background.mp4')
  assert.equal(f.states.at(-1).wallpaperKind, 'video')
  assert.equal(f.states.at(-1).wallpaperScope, 'player')
  f.setting.setting['theme.wallpaper.path'] = '/another-app-background.jpg'
  f.stateEvents.emit('configUpdated', ['theme.wallpaper.path'])
  assert.equal(f.states.at(-1).wallpaperPath, '/lock-background.mp4')
  f.setting.setting['player.lockScreenWallpaper.path'] = ''
  f.setting.setting['player.lockScreenWallpaper.kind'] = 'none'
  f.stateEvents.emit('configUpdated', ['player.lockScreenWallpaper.path', 'player.lockScreenWallpaper.kind'])
  assert.equal(f.states.at(-1).wallpaperPath, '')
  assert.equal(f.states.at(-1).wallpaperKind, 'none')
  assert.equal(f.setting.setting['theme.wallpaper.path'], '/another-app-background.jpg')
  f.cleanup()
})

function wallpaperUI(selection) {
  const changes = []
  const removed = []
  const selected = []
  const settings = {
    'theme.wallpaper.path': '/private/wallpapers/app/keep.jpg',
    'theme.wallpaper.name': 'keep.jpg',
    'theme.wallpaper.kind': 'image',
    'theme.wallpaper.scope': 'all',
    'player.lockScreenWallpaper.path': '/private/wallpapers/old/lock.jpg',
    'player.lockScreenWallpaper.name': 'lock.jpg',
    'player.lockScreenWallpaper.kind': 'image',
  }
  const jsx = (type, props) => ({ type, props })
  const component = load('src/screens/Home/Views/Setting/settings/Theme/Wallpaper.tsx', {
    react: { memo: value => value, useCallback: value => value, useMemo: callback => callback(), useState: value => [value, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', StyleSheet: { create: value => value } },
    '@/components/common/Button': exported('Button'),
    '@/components/common/Text': exported('Text'),
    '@/components/common/CheckBox': exported('CheckBox'),
    '../../components/SubTitle': exported('SubTitle'),
    '@/lang': { useI18n: () => key => key },
    '@/store/setting/hook': { useSettingValue: key => settings[key] },
    '@/core/common': { updateSetting: value => { changes.push(value); Object.assign(settings, value) } },
    '@/utils/fs': {
      privateStorageDirectoryPath: '/private',
      extname: name => name.split('.').at(-1),
      existsFile: async() => true,
      mkdir: async() => {},
      unlink: async path => { removed.push(path) },
      selectFile: async options => { selected.push(options); return selection },
    },
    '@/utils/tools': { toast: () => {}, tipDialog: async() => {} },
    '@/utils/nativeModules/utils': { shareFile: async() => {} },
  }).default
  const nodes = root => Array.isArray(root) ? root.flatMap(nodes) : root && typeof root == 'object' ? [root, ...nodes(root.props?.children)] : []
  const all = nodes(component({ lockScreen: true }))
  const press = async label => {
    const button = all.find(node => node.type == 'Button' && node.props.children?.props.children == label)
    assert.ok(button, `Missing button ${label}`)
    button.props.onPress()
    await new Promise(resolve => setImmediate(resolve))
  }
  return { all, changes, removed, selected, settings, press }
}

test('wallpaper picker imports supported files into private storage and updates only lock screen settings', async() => {
  for (const [name, kind] of [['night.jpg', 'image'], ['stars.gif', 'gif'], ['sky.mp4', 'video']]) {
    const f = wallpaperUI({ isFile: true, name, data: `/private/wallpapers/new/${name}` })
    await f.press('setting_wallpaper_choose')
    assert.ok(f.selected[0].toPath.startsWith('/private/wallpapers/'))
    assert.equal(f.changes.length, 1)
    assert.deepEqual(f.changes[0], {
      'player.lockScreenWallpaper.path': `/private/wallpapers/new/${name}`,
      'player.lockScreenWallpaper.name': name,
      'player.lockScreenWallpaper.kind': kind,
    })
    assert.equal(f.settings['theme.wallpaper.path'], '/private/wallpapers/app/keep.jpg')
    assert.ok(f.removed.includes('/private/wallpapers/old'))
    assert.ok(!f.all.some(node => node.type == 'CheckBox'))
  }
})

test('cancelled or unsupported wallpaper keeps the old background; reset affects only lock screen', async() => {
  for (const selected of [null, { isFile: true, name: 'not-supported.mpkg', data: '/private/wallpapers/new/file.mpkg' }]) {
    const f = wallpaperUI(selected)
    await f.press('setting_wallpaper_choose')
    assert.equal(f.changes.length, 0)
    assert.equal(f.settings['player.lockScreenWallpaper.path'], '/private/wallpapers/old/lock.jpg')
    assert.ok(!f.removed.includes('/private/wallpapers/old'))
  }
  const f = wallpaperUI(null)
  await f.press('恢复黑色星空')
  assert.equal(f.settings['player.lockScreenWallpaper.kind'], 'none')
  assert.equal(f.settings['player.lockScreenWallpaper.path'], '')
  assert.equal(f.settings['theme.wallpaper.path'], '/private/wallpapers/app/keep.jpg')
})
