const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')
const { EventEmitter } = require('node:events')

function library(seed = {}) {
  const saved = new Map(Object.entries(seed))
  const events = new EventEmitter()
  const appEvents = new EventEmitter()
  const intervals = new Map()
  let intervalId = 0
  const state = { isPlay: false, playRate: 1, progress: { nowPlayTime: 0, maxPlayTime: 0 }, playMusicInfo: { musicInfo: null } }
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync('src/core/music/library.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  global.state_event = events
  global.app_event = appEvents
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(module, module.exports, id => {
    if (id === 'react-native') return { DeviceEventEmitter: events, NativeModules: {} }
    if (id === 'react-native-background-timer') return { default: { setInterval: callback => { const current = ++intervalId; intervals.set(current, callback); return current }, clearInterval: current => { intervals.delete(current) } } }
    if (id === '@/plugins/storage') return { getData: async key => structuredClone(saved.get(key) ?? null), saveData: async(key, value) => { await new Promise(resolve => setTimeout(resolve, 2)); saved.set(key, structuredClone(value)) } }
    if (id === '@/store/player/state') return { default: state }
    if (id === '@/config/constant') return { LIST_IDS: { DEFAULT: 'default' } }
    return {}
  })
  return { api: module.exports, saved, state, events, appEvents, intervals }
}
test('download history migrates the previous job and retains concurrent additions', async() => {
  const old = { id: 1, title: '已有下载' }
  const { api } = library({ musicplus_latest_download: old })
  await Promise.all([api.saveDownloadJob({ id: 2 }), api.saveDownloadJob({ id: 3 })])
  assert.deepEqual((await api.getDownloadJobs()).map(job => job.id), [3, 2, 1])
  await api.forgetDownloadJob(3)
  assert.deepEqual((await api.getDownloadJobs()).map(job => job.id), [2, 1])
})
test('recent tracks come from actual playing events and survive rapid track changes without duplicates', async() => {
  const { api, state, appEvents } = library()
  const stop = api.startRecentTracking()
  state.playMusicInfo.musicInfo = { id: 'a', name: 'A' }
  appEvents.emit('pause')
  assert.equal((await api.getRecentTracks()).length, 0)
  state.isPlay = true
  appEvents.emit('play')
  state.playMusicInfo.musicInfo = { id: 'b', name: 'B' }
  appEvents.emit('musicToggled')
  appEvents.emit('play')
  state.playMusicInfo.musicInfo = { id: 'a', name: 'A' }
  appEvents.emit('musicToggled')
  appEvents.emit('play')
  await api.setPlaylistCover('barrier', 'file:///chosen.png')
  assert.deepEqual((await api.getRecentTracks()).map(item => item.music.id), ['a', 'b'])
  stop()
  assert.equal(appEvents.listenerCount('play'), 0)
})

test('play counts persist once across pause and resume while listened time and completion accumulate', async() => {
  const { api, state, appEvents, intervals } = library()
  let now = 100_000
  const realNow = Date.now
  Date.now = () => now
  try {
    const stop = api.startRecentTracking()
    state.playMusicInfo.musicInfo = { id: 'a', name: 'A', singer: 'Artist', interval: '00:30' }
    state.isPlay = true
    appEvents.emit('play')
    now += 15_000
    state.progress.nowPlayTime = 15
    for (const tick of intervals.values()) tick()
    state.isPlay = false
    appEvents.emit('pause')
    now += 45_000
    state.isPlay = true
    appEvents.emit('play')
    now += 15_000
    state.progress.nowPlayTime = 30
    for (const tick of intervals.values()) tick()
    state.isPlay = false
    appEvents.emit('playerEnded')
    await api.setPlaylistCover('barrier', 'file:///chosen.png')
    const [track] = await api.getRecentTracks()
    assert.equal(track.playCount, 1)
    assert.equal(track.completedCount, 1)
    assert.equal(track.listenedSeconds, 30)
    assert.equal(track.measuredSessions, 1)
    assert.equal(track.listenedRatioTotal, 1)
    stop()
    assert.equal(appEvents.listenerCount('play'), 0)
    assert.equal(intervals.size, 0)
  } finally {
    Date.now = realNow
  }
})

test('switching tracks closes the current listening session and records each song once', async() => {
  const { api, state, appEvents, intervals } = library()
  let now = 200_000
  const realNow = Date.now
  Date.now = () => now
  try {
    const stop = api.startRecentTracking()
    state.playMusicInfo.musicInfo = { id: 'a', name: 'A', singer: 'Artist A', interval: '03:00' }
    state.isPlay = true
    appEvents.emit('play')
    now += 8_000
    state.progress.nowPlayTime = 8
    for (const tick of intervals.values()) tick()
    state.playMusicInfo.musicInfo = { id: 'b', name: 'B', singer: 'Artist B', interval: '03:00' }
    appEvents.emit('musicToggled')
    state.progress.nowPlayTime = 0
    state.isPlay = true
    appEvents.emit('play')
    now += 4_000
    state.progress.nowPlayTime = 4
    stop()
    await api.setPlaylistCover('barrier', 'file:///chosen.png')
    const recent = await api.getRecentTracks()
    assert.deepEqual(recent.map(item => [item.music.id, item.playCount, item.listenedSeconds]), [['b', 1, 4], ['a', 1, 8]])
    assert.equal(intervals.size, 0)
  } finally {
    Date.now = realNow
  }
})

test('buffering, paused time and seeking to the end do not count as a completed listen', async() => {
  const { api, state, appEvents, intervals } = library()
  let now = 300_000
  const realNow = Date.now
  Date.now = () => now
  try {
    const stop = api.startRecentTracking()
    state.playMusicInfo.musicInfo = { id: 'a', name: 'A', interval: '04:00' }
    state.progress.maxPlayTime = 240
    state.isPlay = true
    appEvents.emit('play')
    now += 15_000
    for (const tick of intervals.values()) tick()
    state.progress.nowPlayTime = 10
    now += 10_000
    appEvents.emit('setProgress', 235)
    state.progress.nowPlayTime = 235
    appEvents.emit('seekCompleted', 235)
    now += 5_000
    state.progress.nowPlayTime = 240
    appEvents.emit('playerEnded')
    await api.setPlaylistCover('barrier', 'x')
    const [track] = await api.getRecentTracks()
    assert.equal(track.listenedSeconds, 15)
    assert.equal(track.completedCount, 0)
    assert.equal(track.listenedRatioTotal, 15 / 240)
    stop()
  } finally { Date.now = realNow }
})

test('replaying one segment cannot inflate coverage, and playback rate changes real listening time', async() => {
  const { api, state, appEvents, intervals } = library()
  let now = 400_000
  const realNow = Date.now
  Date.now = () => now
  try {
    const stop = api.startRecentTracking()
    state.playMusicInfo.musicInfo = { id: 'a', name: 'A', interval: '01:00' }
    state.progress.maxPlayTime = 60
    state.playRate = 2
    state.isPlay = true
    appEvents.emit('play')
    now += 15_000
    state.progress.nowPlayTime = 30
    for (const tick of intervals.values()) tick()
    appEvents.emit('setProgress', 0)
    state.progress.nowPlayTime = 0
    appEvents.emit('seekCompleted', 0)
    now += 15_000
    state.progress.nowPlayTime = 30
    appEvents.emit('pause')
    await api.setPlaylistCover('barrier', 'x')
    const [track] = await api.getRecentTracks()
    assert.equal(track.measuredListenedSeconds, 30)
    assert.equal(track.listenedRatioTotal, 0.5)
    assert.equal(track.completedCount, 0)
    stop()
  } finally { Date.now = realNow }
})
