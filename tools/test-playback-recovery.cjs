const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')

const song = (source, id = source) => ({ id, source, name: 'Test song', singer: 'Test artist', meta: { albumName: 'Test album' } })
const deferred = () => Promise.withResolvers()

// Load the real URL resolver, playback coordinator and error listeners. Only
// native audio/network/timers/storage are replaced; no live provider is needed.
function fixture() {
  const timers = new Map(); const listeners = new Map(); const cache = new Map()
  const calls = []; const resources = []; const statuses = []; const positions = []; const updates = []
  let timerId = 0; let nextCount = 0; let searches = 0
  const original = song('tx')
  const state = {
    playMusicInfo: { musicInfo: original, listId: 'test', isTempPlay: false },
    musicInfo: { id: original.id },
    progress: { nowPlayTime: 42 },
    isPlay: false,
  }
  const f = {
    state,
    calls,
    resources,
    statuses,
    positions,
    updates,
    timers,
    now: 1000000,
    alternatives: [song('kw'), song('kg'), song('wy')],
    url: async info => `https://audio.test/${info.source}.mp3`,
    position: async() => 42,
    resource: () => {},
  }
  const emit = name => { for (const callback of listeners.get(name) || []) callback() }
  const global = {
    lx: { gettingUrlId: '', isPlayedStop: false },
    i18n: { t: key => key },
    app_event: { on: (name, callback) => listeners.set(name, [...listeners.get(name) || [], callback]), error: () => { state.isPlay = false } },
  }
  const stubs = {
    '@/core/music': { getMusicUrl: async options => { calls.push(options); return f.url(options.musicInfo, options) } },
    '@/core/music/utils': { getOtherSource: async() => { searches++; return f.alternatives } },
    '@/utils/message': { requestMsg: { timeout: 'timeout', fail: 'failed', cancelRequest: 'cancel', tooManyRequests: 'busy' } },
    'react-native-background-timer': {
      default: {
        setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id },
        clearTimeout: id => timers.delete(id),
      },
    },
    '@/store/player/state': { default: state },
    '@/store/setting/state': { default: { setting: { 'common.apiSource': 'test-api', 'player.playbackRate': 1 } } },
    '@/plugins/storage': { getData: async() => null, saveData: async() => {} },
    '@/core/player/playStatus': { setStatusText: value => { statuses.push(value) } },
    '@/core/player/progress': { setNowPlayTime: value => { positions.push(value); state.progress.nowPlayTime = value } },
    '@/plugins/player': {
      getPosition: () => f.position(),
      isEmpty: () => false,
      setStop: async() => {},
      setResource: (info, url, time) => {
        global.lx.playerTrackId = `${info.id}__//1__//${url}`
        resources.push({ info, url, time, marker: global.lx.gettingUrlId }); f.resource()
      },
    },
    '@/utils/common': { getRandom: () => 2 },
    '@/utils/tools': { debounceBackgroundTimer: callback => callback, isActive: () => true },
    '@/config/constant': { LIST_IDS: {} },
    '@/core/list': { updateListMusics: async infos => { updates.push(...infos) } },
    '@/core/player/playInfo': {},
    '@/core/player/playedList': {},
    '@/core/player/tempPlayList': {},
    '@/core/dislikeList': {},
  }
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename)
    const exports = {}
    cache.set(filename, exports)
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText
    const requireStub = id => {
      if (id.endsWith('/urlResolver') || id === './urlResolver') return load('src/core/player/urlResolver.ts')
      if (id === './sourceReliability') return load('src/core/player/sourceReliability.ts')
      if (id === '@/utils/musicVersionMatch') return load('src/utils/musicVersionMatch.ts')
      if (id === './progress') return stubs['@/core/player/progress']
      if (id === './utils') return {}
      if (id === '@/core/player/player') return { ...load('src/core/player/player.ts'), playNext: async() => { nextCount++ } }
      assert.ok(stubs[id], `Unexpected import: ${id}`)
      return stubs[id]
    }
    // eslint-disable-next-line no-new-func
    new Function('exports', 'require', 'global', 'console', 'Date', code)(exports, requireStub, global, { log() {}, warn() {} }, { now: () => f.now })
    return exports
  }
  f.player = load('src/core/player/player.ts')
  f.health = load('src/core/player/sourceReliability.ts').playbackSources
  f.setting = stubs['@/store/setting/state'].default.setting
  load('src/core/init/player/playerEvent.ts').default()
  f.flush = async() => { for (let i = 0; i < 60; i++) await Promise.resolve() }
  f.emit = emit
  f.global = global
  f.advance = async delay => {
    f.now += delay
    const ready = [...timers].filter(([, timer]) => timer.delay === delay)
    for (const [id, timer] of ready) { timers.delete(id); timer.callback() }
    await f.flush()
  }
  f.start = async() => { f.player.setMusicUrl(state.playMusicInfo.musicInfo); await f.flush() }
  f.fail = async() => { emit('playerError'); await f.flush() }
  f.nextCount = () => nextCount
  f.searches = () => searches
  return f
}

test('a cached/dead URL automatically switches source without a manual action', async() => {
  const f = fixture()
  await f.start()
  f.emit('playerError'); f.emit('playerError')
  await f.flush()
  assert.deepEqual(f.calls.map(call => [call.musicInfo.source, call.isRefresh]), [['tx', false], ['tx', true], ['kw', true]])
  assert.equal(f.resources.at(-1).url, 'https://audio.test/kw.mp3')
  assert.equal(f.resources.at(-1).time, 42)
  assert.ok(f.resources.every(resource => resource.marker === ''))
  f.emit('playerPlaying')
  assert.equal(f.statuses.at(-1), '')
  assert.equal(f.state.playMusicInfo.musicInfo.source, 'tx')
})

test('a new URL is tried once, then an actual playback failure moves to another platform', async() => {
  const f = fixture()
  f.url = async(info, options) => `https://audio.test/${info.source}-${options.isRefresh}.mp3`
  await f.start(); await f.fail(); await f.fail()
  assert.deepEqual(f.calls.map(call => call.musicInfo.source), ['tx', 'tx', 'kw'])
  await f.fail()
  assert.equal(f.resources.at(-1).url, 'https://audio.test/kg-true.mp3')
  assert.equal(f.calls.filter(call => call.musicInfo.source === 'tx').length, 2)
})

test('empty URLs, provider errors and duplicate candidates are skipped', async() => {
  const f = fixture()
  f.alternatives = [song('tx', 'duplicate'), song('kw'), song('kw', 'another'), song('kg')]
  f.url = async info => {
    if (info.source === 'tx') throw Error('provider failed')
    return info.source === 'kw' ? '' : 'https://audio.test/working.mp3'
  }
  await f.start()
  assert.deepEqual(f.calls.map(call => call.musicInfo.source), ['tx', 'kw', 'kg'])
  assert.equal(f.resources.length, 1)
})

test('hung URL requests time out and continue to an alternative', async() => {
  const f = fixture(); const pending = deferred()
  f.url = info => info.source === 'tx' ? pending.promise : Promise.resolve('https://audio.test/working.mp3')
  await f.start()
  await f.advance(12000)
  assert.equal(f.resources.at(-1).url, 'https://audio.test/working.mp3')
  pending.resolve('https://audio.test/late.mp3'); await f.flush()
  assert.equal(f.resources.length, 1)
})

test('exhausting all sources ends the refresh and schedules the existing next-song policy', async() => {
  const f = fixture()
  f.url = async() => { throw Error('unavailable') }
  await f.start()
  assert.equal(f.global.lx.gettingUrlId, '')
  assert.equal(f.statuses.at(-1), 'toggle_source_failed')
  assert.equal(f.calls.length, 4)
  assert.equal(f.resources.length, 0)
  assert.ok([...f.timers.values()].some(timer => timer.delay === 5000))
})

test('the initial connecting state is monitored even when isPlay is false', async() => {
  const f = fixture()
  f.resource = () => f.emit('playerLoadstart')
  await f.start()
  assert.equal(f.state.isPlay, false)
  assert.ok([...f.timers.values()].some(timer => timer.delay === 25000))
  await f.advance(25000)
  assert.equal(f.resources.at(-1).url, 'https://audio.test/kw.mp3')
})

test('buffering timeout also recovers, and successful playing clears it', async() => {
  const f = fixture()
  await f.start(); f.emit('playerWaiting')
  await f.advance(25000)
  assert.equal(f.resources.at(-1).url, 'https://audio.test/kw.mp3')
  f.emit('playerWaiting'); f.emit('playerPlaying')
  assert.equal(f.timers.size, 0)
})

test('a failed/hung native position lookup cannot prevent recovery', async() => {
  const f = fixture(); const pending = deferred()
  await f.start()
  f.position = () => pending.promise
  f.emit('playerError'); await f.flush()
  await f.advance(1000)
  assert.equal(f.resources.at(-1).url, 'https://audio.test/kw.mp3')
  assert.equal(f.resources.at(-1).time, 42)
})

test('an old position result cannot seek a new selection, including the same song', async() => {
  const f = fixture(); const pending = deferred()
  await f.start()
  f.position = () => pending.promise
  f.emit('playerError')
  f.state.playMusicInfo = { ...f.state.playMusicInfo }
  f.emit('musicToggled')
  pending.resolve(150); await f.flush()
  assert.deepEqual(f.positions, [])
  assert.equal(f.resources.length, 1)
})

for (const outcome of ['resolve', 'reject']) {
  test(`an old URL ${outcome} cannot replace or unlock a newer request`, async() => {
    const f = fixture(); const old = deferred(); const next = deferred()
    f.url = info => info.source === 'tx' ? old.promise : next.promise
    await f.start()
    f.state.playMusicInfo = { ...f.state.playMusicInfo, musicInfo: song('wy') }
    f.player.setMusicUrl(f.state.playMusicInfo.musicInfo)
    old[outcome](outcome === 'resolve' ? 'https://audio.test/old.mp3' : Error('old failure'))
    await f.flush()
    assert.equal(f.global.lx.gettingUrlId, 'wy_')
    assert.equal(f.resources.length, 0)
    next.resolve('https://audio.test/new.mp3'); await f.flush()
    assert.equal(f.resources.length, 1)
    assert.equal(f.resources[0].info.source, 'wy')
    assert.equal(f.global.lx.gettingUrlId, '')
  })
}

test('manual source selection preserves identity, position and list order', async() => {
  const f = fixture()
  await f.start()
  const selection = f.state.playMusicInfo; const original = selection.musicInfo
  assert.equal(await f.player.switchCurrentSource(song('kg'), selection), true)
  await f.flush()
  assert.equal(f.state.playMusicInfo, selection)
  assert.equal(f.state.playMusicInfo.musicInfo, original)
  assert.equal(original.meta.toggleMusicInfo.source, 'kg')
  assert.equal(f.resources.at(-1).time, 42)
  assert.equal(f.resources.at(-1).url, 'https://audio.test/kg.mp3')
  assert.equal(f.updates[0].id, original.id)
  assert.equal(f.calls.at(-1).isRefresh, true)
})

test('confirming a source for an old song does not modify the current song', async() => {
  const f = fixture(); const old = f.state.playMusicInfo
  f.state.playMusicInfo = { ...old, musicInfo: song('wy') }
  assert.equal(await f.player.switchCurrentSource(song('kg'), old), false)
  assert.equal(f.calls.length, 0)
  assert.equal(f.updates.length, 0)
})

test('choosing the same manual source invalidates its older pending request', async() => {
  const f = fixture()
  const old = deferred()
  const next = deferred()
  const target = song('kw')
  f.state.playMusicInfo.musicInfo.meta.toggleMusicInfo = target
  let requests = 0
  f.url = () => ++requests === 1 ? old.promise : next.promise
  await f.start()
  await f.player.switchCurrentSource(target)
  old.reject(Error('old failure'))
  await f.flush()
  assert.equal(f.searches(), 0)
  assert.equal(f.global.lx.gettingUrlId, 'tx_kw')
  next.resolve('https://audio.test/manual.mp3')
  await f.flush()
  assert.equal(f.resources.length, 1)
  assert.equal(f.resources[0].url, 'https://audio.test/manual.mp3')
})

test('local files retain the existing local-file resolution path', async() => {
  const f = fixture()
  f.state.playMusicInfo.musicInfo = song('local')
  f.url = async() => '/storage/emulated/0/Music/test.mp3'
  await f.start()
  assert.equal(f.searches(), 0)
  assert.equal(f.resources[0].url, '/storage/emulated/0/Music/test.mp3')
})

test('a returned URL cannot start playback after a scheduled stop', async() => {
  const f = fixture(); const pending = deferred()
  f.url = () => pending.promise
  await f.start()
  f.global.lx.isPlayedStop = true
  pending.resolve('https://audio.test/late.mp3'); await f.flush()
  assert.equal(f.resources.length, 0)
  assert.equal(f.global.lx.gettingUrlId, '')
})

const historyKey = music => JSON.stringify([music.source, music.id, music.meta.toggleMusicInfo?.source ?? '', music.meta.toggleMusicInfo?.id ?? ''])

test('a URL alone, stalled clocks, seeks and a different native stream cannot earn source success', async() => {
  const f = fixture()
  await f.start()
  const key = historyKey(f.state.playMusicInfo.musicInfo)
  assert.equal(f.health.preferred('test-api', key), undefined)
  f.state.isPlay = true
  for (let i = 0; i < 8; i++) { f.now += 500; f.player.observePlaybackSource(42) }
  assert.equal(f.health.preferred('test-api', key), undefined)
  f.player.observePlaybackSource(180)
  assert.equal(f.health.preferred('test-api', key), undefined)
  f.global.lx.playerTrackId = 'another-stream'
  for (let i = 0; i < 8; i++) { f.now += 500; f.player.observePlaybackSource(180 + i / 2) }
  assert.equal(f.health.preferred('test-api', key), undefined)
})

test('three seconds of confirmed progress remembers the working source for the next selection', async() => {
  const f = fixture()
  await f.start(); await f.fail()
  const original = f.state.playMusicInfo.musicInfo
  const key = historyKey(original)
  f.state.isPlay = true
  f.player.observePlaybackSource(42)
  for (let i = 1; i <= 6; i++) { f.now += 500; f.player.observePlaybackSource(42 + i / 2) }
  assert.equal(f.health.preferred('test-api', key).source, 'kw')
  f.state.playMusicInfo = { ...f.state.playMusicInfo, musicInfo: { ...original } }
  f.emit('musicToggled')
  const count = f.calls.length
  await f.start()
  assert.deepEqual(f.calls.slice(count).map(call => call.musicInfo.source), ['kw'])
})

test('slow playback can earn success with its slower native polling interval', async() => {
  const f = fixture()
  await f.start()
  f.setting['player.playbackRate'] = 0.25
  f.state.isPlay = true
  f.player.observePlaybackSource(42)
  for (let i = 1; i <= 6; i++) { f.now += 2000; f.player.observePlaybackSource(42 + i / 2) }
  assert.equal(f.health.preferred('test-api', historyKey(f.state.playMusicInfo.musicInfo)).source, 'tx')
})

test('continuous failures on distinct songs skip the unhealthy platform, but manual selection can retry it', async() => {
  const f = fixture()
  f.url = async info => {
    if (info.source === 'tx') throw Error('temporarily unavailable')
    return `https://audio.test/${info.source}.mp3`
  }
  for (const id of ['one', 'two', 'three', 'four']) {
    f.state.playMusicInfo = { ...f.state.playMusicInfo, musicInfo: song('tx', id) }
    f.emit('musicToggled'); await f.start()
  }
  assert.equal(f.calls.filter(call => call.musicInfo.source === 'tx').length, 3)
  assert.equal(f.health.blockedSource('test-api', 'tx'), true)
  f.url = async() => 'https://audio.test/manual.mp3'
  await f.player.switchCurrentSource(song('tx', 'manual'))
  await f.flush()
  assert.equal(f.calls.at(-1).musicInfo.id, 'manual')
  assert.equal(f.resources.at(-1).url, 'https://audio.test/manual.mp3')
})

test('repeated failing manual candidates for the same playlist entry do not blacklist the platform', async() => {
  const f = fixture()
  f.url = async info => {
    if (info.source === 'tx') throw Error('song unavailable')
    return `https://audio.test/${info.source}.mp3`
  }
  for (const id of ['candidate-one', 'candidate-two', 'candidate-three']) {
    await f.player.switchCurrentSource(song('tx', id))
    await f.flush()
  }
  assert.equal(f.calls.filter(call => call.musicInfo.source === 'tx').length, 3)
  assert.equal(f.health.blockedSource('test-api', 'tx'), false)
})

test('when all compatible platforms are cooling, one recovery probe can still play', async() => {
  const f = fixture()
  await f.health.ready()
  for (const source of ['tx', 'kw', 'kg', 'wy']) for (const track of ['bad-a', 'bad-b', 'bad-c']) f.health.failure('test-api', track, source)
  await f.start()
  assert.equal(f.calls.length, 1)
  assert.equal(f.resources.length, 1)
})

test('automatic fallback does not request a cover or live version that precedes the correct candidate', async() => {
  const f = fixture()
  f.url = async info => {
    if (info.source === 'tx') throw Error('unavailable')
    return `https://audio.test/${info.source}.mp3`
  }
  f.alternatives = [{ ...song('kw'), name: 'Test song (Live)' }, { ...song('kg'), singer: 'Different artist' }, song('wy')]
  await f.start()
  assert.deepEqual(f.calls.map(call => call.musicInfo.source), ['tx', 'wy'])
})

test('an explicit DJ selection is allowed, and its later fallback does not silently return to studio audio', async() => {
  const f = fixture()
  const dj = { ...song('kw'), name: 'Test song (DJ Remix)' }
  f.alternatives = [song('kg'), { ...song('wy'), name: 'Test song (DJ Remix)' }]
  await f.player.switchCurrentSource(dj)
  await f.flush()
  assert.equal(f.resources.at(-1).url, 'https://audio.test/kw.mp3')
  await f.fail()
  assert.equal(f.resources.at(-1).url, 'https://audio.test/wy.mp3')
  assert.equal(f.calls.some(call => call.musicInfo.source === 'tx' || call.musicInfo.source === 'kg'), false)
})

test('changing custom APIs invalidates old requests and does not transfer their failures', async() => {
  const f = fixture()
  const old = deferred()
  const next = deferred()
  let requests = 0
  f.url = () => ++requests === 1 ? old.promise : next.promise
  await f.start()
  const key = historyKey(f.state.playMusicInfo.musicInfo)
  f.setting['common.apiSource'] = 'other-api'
  f.player.setMusicUrl(f.state.playMusicInfo.musicInfo)
  old.reject(Error('old API failed'))
  await f.flush()
  assert.equal(f.health.blockedTrack('test-api', key, 'tx'), false)
  next.resolve('https://audio.test/new-api.mp3')
  await f.flush()
  assert.equal(f.resources.at(-1).url, 'https://audio.test/new-api.mp3')
})

test('a cancelled provider request cannot penalize its platform', async() => {
  const f = fixture()
  f.url = async() => { throw Error('cancel') }
  await f.start()
  const key = historyKey(f.state.playMusicInfo.musicInfo)
  assert.equal(f.health.blockedTrack('test-api', key, 'tx'), false)
  assert.equal(f.calls.length, 1)
})
