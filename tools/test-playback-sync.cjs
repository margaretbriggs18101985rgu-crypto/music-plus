const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')

function load(filename, dependencies = {}, clock = Date) {
  const module = { exports: {} }
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  new Function('module', 'exports', 'require', 'Date', output)(module, module.exports, id => { // eslint-disable-line no-new-func
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`)
    return dependencies[id]
  }, clock)
  return module.exports
}
const { createPlaybackSeeker } = load('src/core/player/seek.ts')
const flush = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => {
  let done, fail
  const promise = new Promise((resolve, reject) => { done = resolve; fail = reject })
  return { promise, resolve: done, reject: fail }
}

test('rapid seeks serialize native operations, skip intermediate targets, and publish only actual audio time', async() => {
  const first = deferred()
  const calls = []; const positions = []
  let actual = 0
  const seeker = createPlaybackSeeker({
    trackId: () => 'song',
    seek: async time => { calls.push(time); if (calls.length === 1) await first.promise; actual = time - 0.1 },
    position: async() => actual,
    commit: time => positions.push(time),
    failed: assert.fail,
  })
  seeker.request(30)
  seeker.request(60)
  seeker.request(90)
  assert.deepEqual(calls, [30])
  assert.deepEqual(positions, [])
  first.resolve()
  await flush()
  assert.deepEqual(calls, [30, 90])
  assert.deepEqual(positions, [89.9])
  assert.equal(seeker.busy, false)
})

test('ignored and rejected native seeks never publish the requested lyric time, including zero', async() => {
  const positions = []; const errors = []
  let reject = false
  const seeker = createPlaybackSeeker({
    trackId: () => 'song',
    seek: async() => { if (reject) throw Error('not seekable') },
    position: async() => 0,
    commit: time => positions.push(time),
    failed: error => errors.push(error),
  })
  seeker.request(80)
  await flush()
  reject = true
  seeker.request(20)
  await flush()
  assert.deepEqual(positions, [0, 0])
  assert.equal(errors.length, 1)
})

test('track changes discard queued and in-flight seek results', async() => {
  const wait = deferred(); const calls = []; const positions = []
  let id = 'first'
  const seeker = createPlaybackSeeker({
    trackId: () => id,
    seek: async time => { calls.push(time); await wait.promise },
    position: async() => 45,
    commit: time => positions.push(time),
    failed: assert.fail,
  })
  seeker.request(45)
  seeker.request(60)
  id = 'second'
  seeker.invalidate()
  wait.resolve()
  await flush()
  assert.deepEqual(calls, [45])
  assert.deepEqual(positions, [])
})

test('poll started before a seek cannot rewind the confirmed progress or lyric clock', async() => {
  const listeners = {}; const stateListeners = {}; const positions = []; const lyrics = []; const completed = []; const observations = []
  const oldPoll = deferred()
  const player = {
    musicInfo: { id: 'song' },
    isPlay: true,
    progress: { nowPlayTime: 10, maxPlayTime: 180 },
    playMusicInfo: { isTempPlay: true },
  }
  let reads = 0
  const oldGlobal = global.app_event; const oldState = global.state_event
  global.app_event = { on: (name, callback) => { listeners[name] = callback }, seekCompleted: time => completed.push(time) }
  global.state_event = { on: (name, callback) => { stateListeners[name] = callback } }
  try {
    load('src/core/init/player/playProgress.ts', {
      '@/core/list': {},
      '@/core/player/progress': { setNowPlayTime: time => positions.push(time), setMaxplayTime: () => {} },
      '@/plugins/player': {
        setCurrentTime: async() => {},
        getDuration: async() => 180,
        getPosition: () => ++reads === 1 ? oldPoll.promise : Promise.resolve(90),
      },
      '@/utils/common': {},
      '@/utils/data': {},
      '@/utils/tools': { throttleBackgroundTimer: fn => fn },
      'react-native-background-timer': { setInterval: () => 1, clearInterval: () => {} },
      '@/store/player/state': { __esModule: true, default: player },
      '@/store/setting/state': { __esModule: true, default: { setting: { 'player.playbackRate': 1 } } },
      '@/utils/nativeModules/utils': { onScreenStateChange: () => {} },
      'react-native': { AppState: { addEventListener: () => {} } },
      '@/core/player/seek': { createPlaybackSeeker },
      '@/core/lyric': { syncPosition: time => lyrics.push(time) },
      '@/core/player/player': { observePlaybackSource: time => observations.push(time), needsPlaybackSourceObservation: () => false },
    }).default()
    listeners.play()
    listeners.setProgress(90)
    await flush()
    oldPoll.resolve(10)
    await flush()
    assert.deepEqual(positions, [90])
    assert.deepEqual(lyrics, [90])
    assert.deepEqual(completed, [90])
    assert.deepEqual(observations, [])
  } finally { global.app_event = oldGlobal; global.state_event = oldState }
})

test('overlapping position polls keep the newest native clock reading', async() => {
  const oldPoll = deferred(); const newPoll = deferred()
  const listeners = {}; const positions = []; const observations = []
  const player = {
    musicInfo: { id: 'song' },
    isPlay: true,
    progress: { nowPlayTime: 10, maxPlayTime: 180 },
    playMusicInfo: { isTempPlay: true },
  }
  let reads = 0; let tick
  const oldGlobal = global.app_event; const oldState = global.state_event
  global.app_event = { on: (name, callback) => { listeners[name] = callback }, seekCompleted: () => {} }
  global.state_event = { on: (name, callback) => { listeners[`state:${name}`] = callback } }
  try {
    load('src/core/init/player/playProgress.ts', {
      '@/core/list': {},
      '@/core/player/progress': { setNowPlayTime: time => positions.push(time), setMaxplayTime: () => {} },
      '@/plugins/player': {
        setCurrentTime: async() => {},
        getDuration: async() => 180,
        getPosition: () => ++reads == 1 ? oldPoll.promise : newPoll.promise,
      },
      '@/utils/common': {},
      '@/utils/data': {},
      '@/utils/tools': { throttleBackgroundTimer: fn => fn },
      'react-native-background-timer': { setInterval: callback => { tick = callback; return 1 }, clearInterval: () => {} },
      '@/store/player/state': { __esModule: true, default: player },
      '@/store/setting/state': { __esModule: true, default: { setting: { 'player.playbackRate': 1 } } },
      '@/utils/nativeModules/utils': { onScreenStateChange: () => {} },
      'react-native': { AppState: { addEventListener: () => {} } },
      '@/core/player/seek': { createPlaybackSeeker },
      '@/core/lyric': { syncPosition: () => {} },
      '@/core/player/player': { observePlaybackSource: time => observations.push(time), needsPlaybackSourceObservation: () => false },
    }).default()
    listeners.play()
    tick()
    newPoll.resolve(90)
    await flush()
    oldPoll.resolve(10)
    await flush()
    assert.deepEqual(positions, [90])
    assert.deepEqual(observations, [90])
  } finally { global.app_event = oldGlobal; global.state_event = oldState }
})

for (const outcome of ['confirmed', 'stalled']) {
  test(`screen-off source sampling stops when ${outcome === 'confirmed' ? 'success is confirmed' : 'the confirmation window expires'}`, async() => {
    const listeners = {}; const observations = []
    let now = 0; let pending = true; let tick; let screenChanged; let clears = 0
    const player = { musicInfo: { id: 'song' }, isPlay: true, progress: { nowPlayTime: 1, maxPlayTime: 180 }, playMusicInfo: { isTempPlay: true } }
    const oldGlobal = global.app_event; const oldState = global.state_event
    global.app_event = { on: (name, callback) => { listeners[name] = callback } }
    global.state_event = { on: () => {} }
    try {
      load('src/core/init/player/playProgress.ts', {
        '@/core/list': {},
        '@/core/player/progress': { setNowPlayTime: () => {}, setMaxplayTime: () => {} },
        '@/plugins/player': { setCurrentTime: async() => {}, getDuration: async() => 180, getPosition: async() => 1 },
        '@/utils/common': {},
        '@/utils/data': {},
        '@/utils/tools': { throttleBackgroundTimer: fn => fn },
        'react-native-background-timer': { setInterval: callback => { tick = callback; return 1 }, clearInterval: () => { clears++ } },
        '@/store/player/state': { __esModule: true, default: player },
        '@/store/setting/state': { __esModule: true, default: { setting: { 'player.playbackRate': 1 } } },
        '@/utils/nativeModules/utils': { onScreenStateChange: callback => { screenChanged = callback } },
        'react-native': { AppState: { addEventListener: () => {} } },
        '@/core/player/seek': { createPlaybackSeeker },
        '@/core/lyric': { syncPosition: () => {} },
        '@/core/player/player': { observePlaybackSource: time => observations.push(time), needsPlaybackSourceObservation: () => pending },
      }, { now: () => now }).default()
      listeners.play(); await flush()
      screenChanged('OFF'); await flush()
      const before = clears
      if (outcome === 'confirmed') pending = false
      else now = 21000
      tick(); await flush()
      assert.equal(clears, before + 1)
      assert.ok(observations.length >= 2)
    } finally { global.app_event = oldGlobal; global.state_event = oldState }
  })
}

test('paused lyric seeks render the confirmed line and remain paused', () => {
  const played = []; const paused = []
  const player = { isPlay: false, musicInfo: { id: 'song' } }
  const lyric = load('src/core/lyric.ts', {
    '@/plugins/lyric': { play: time => played.push(time), pause: () => paused.push(true) },
    '@/core/desktopLyric': { playDesktopLyric: async() => {}, pauseDesktopLyric: async() => {} },
    '@/plugins/player': {},
    '@/store/player/state': { __esModule: true, default: player },
    '@/store/setting/state': { __esModule: true, default: { setting: { 'player.playbackRate': 1 } } },
    '@/plugins/player/utils': {},
  })
  lyric.syncPosition(65, true)
  assert.deepEqual(played, [65000])
  assert.equal(paused.length, 1)
})

test('quality switching keeps the real position and paused state and saves only after a successful swap', async() => {
  const calls = []
  const music = { id: 'song', source: 'wy', meta: {} }
  const state = { playMusicInfo: { musicInfo: music }, isPlay: false }
  const { switchCurrentQuality } = load('src/core/player/quality.ts', {
    '@/core/music': { getMusicUrl: async options => { assert.equal(options.quality, 'flac'); return 'https://example.test/song.flac' } },
    '@/plugins/player': { getPosition: async() => 73.8 },
    '@/plugins/player/playList': { playMusic: async(...args) => { calls.push(args) } },
    '@/store/player/state': { __esModule: true, default: state },
    '@/core/common': { updateSetting: setting => calls.push(setting) },
  })
  assert.equal(await switchCurrentQuality('flac'), true)
  assert.deepEqual(calls, [[music, 'https://example.test/song.flac', 73.8, false], { 'player.playQuality': 'flac' }])
})

test('quality lookup finishing after a track change cannot replace the new song', async() => {
  const wait = deferred()
  const state = { playMusicInfo: { musicInfo: { id: 'song', source: 'wy', meta: {} } }, isPlay: true }
  const { switchCurrentQuality } = load('src/core/player/quality.ts', {
    '@/core/music': { getMusicUrl: () => wait.promise },
    '@/plugins/player': { getPosition: assert.fail },
    '@/plugins/player/playList': { playMusic: assert.fail },
    '@/store/player/state': { __esModule: true, default: state },
    '@/core/common': { updateSetting: assert.fail },
  })
  const pending = switchCurrentQuality('320k')
  state.playMusicInfo.musicInfo = { id: 'new-song', source: 'wy', meta: {} }
  wait.resolve('https://example.test/old-song.mp3')
  assert.equal(await pending, false)
})

test('failed quality lookup keeps the existing audio and saved preference', async() => {
  const state = { playMusicInfo: { musicInfo: { id: 'song', source: 'wy', meta: {} } }, isPlay: true }
  const { switchCurrentQuality } = load('src/core/player/quality.ts', {
    '@/core/music': { getMusicUrl: async() => { throw Error('quality unavailable') } },
    '@/plugins/player': { getPosition: assert.fail },
    '@/plugins/player/playList': { playMusic: assert.fail },
    '@/store/player/state': { __esModule: true, default: state },
    '@/core/common': { updateSetting: assert.fail },
  })
  await assert.rejects(switchCurrentQuality('flac'), /unavailable/)
})

test('native track swap finishes before reporting success and does not auto-play a paused track', async() => {
  const calls = []
  let queue = [{ id: 'previous' }]
  const trackPlayer = {
    getCurrentTrack: async() => 0,
    add: async tracks => { queue.push(...tracks) },
    getQueue: async() => queue,
    skip: async index => { calls.push(['skip', index]) },
    seekTo: async time => { calls.push(['seek', time]) },
    play: async() => { calls.push(['play']) },
    pause: async() => { calls.push(['pause']) },
    remove: async indexes => { queue = queue.filter((_, index) => !indexes.includes(index)) },
  }
  const setting = { 'player.isShowNotificationImage': false, 'player.isShowBluetoothFullLyric': false }
  const oldGlobal = global.lx
  global.lx = { restorePlayInfo: null }
  try {
    const { playMusic } = load('src/plugins/player/playList.ts', {
      'react-native-track-player': { __esModule: true, default: trackPlayer },
      'react-native-background-timer': {},
      '@/config': { defaultUrl: 'placeholder.wav' },
      '@/store/setting/state': { __esModule: true, default: { setting } },
      '@/store/player/state': { __esModule: true, default: {} },
    })
    await playMusic({ id: 'song', name: 'Song', singer: '', meta: {} }, 'https://example.test/song.flac', 73.8, false)
    assert.deepEqual(calls, [['skip', 1], ['pause'], ['seek', 73.8]])
  } finally { global.lx = oldGlobal }
})
