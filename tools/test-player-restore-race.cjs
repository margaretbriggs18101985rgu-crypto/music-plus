const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')

// Exercise the actual private restore callback, including its asynchronous
// completion guards, without initializing the Android audio service in Node.
function fixture() {
  const source = ts.createSourceFile('player.ts', fs.readFileSync('src/core/player/player.ts', 'utf8'), ts.ScriptTarget.Latest, true)
  const declaration = source.statements.flatMap(statement => ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : [])
    .find(variable => variable.name.getText(source) === 'handleRestorePlay')
  assert.ok(declaration)
  const code = ts.transpileModule(`const restore = ${declaration.initializer.getText(source)}; return restore`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText
  const deferred = () => {
    let resolve, reject
    const promise = new Promise((yes, no) => { resolve = yes; reject = no })
    return { promise, resolve, reject }
  }
  const pic = deferred(), lyric = deferred()
  const selected = { musicInfo: { id: 'old' }, listId: 'test', isTempPlay: false }
  const state = { playMusicInfo: selected, musicInfo: { pic: 'previous' }, loadErrorPicUrl: '' }
  const updates = [], events = [], timers = [], statuses = []
  const dependencies = {
    playerState: state,
    settingState: { setting: { 'player.isSavePlayTime': true, 'player.togglePlayMethod': 'listLoop' } },
    setTimeout: callback => timers.push(callback),
    global: { app_event: { setProgress: (...args) => events.push(['progress', ...args]), picUpdated: () => events.push('pic'), lyricUpdated: () => events.push('lyric') }, i18n: { t: value => value } },
    initTrackInfo: () => {}, getPicPath: () => pic.promise, getLyricInfo: () => lyric.promise,
    setMusicInfo: update => updates.push(update), setStatusText: value => statuses.push(value), addPlayedList: () => {},
    console: { log() {} },
  }
  const restore = new Function(...Object.keys(dependencies), code)(...Object.values(dependencies))
  const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
  return { state, selected, pic, lyric, updates, events, timers, statuses, restore, flush }
}

test('restoring the current track still applies its progress, artwork and lyrics', async () => {
  const f = fixture()
  await f.restore({ time: 42, maxTime: 180 })
  f.timers.forEach(run => run())
  f.pic.resolve('current-cover'); f.lyric.resolve({ lyric: 'current lyrics', rawlrcInfo: { lyric: 'raw' } })
  await f.flush()
  assert.equal(f.updates[0].pic, 'current-cover')
  assert.equal(f.updates[1].lrc, 'current lyrics')
  assert.deepEqual(f.events, [['progress', 42, 180], 'pic', 'lyric'])
})

for (const id of ['new', 'old']) {
  test(`a late restore cannot overwrite a later selection with id ${id}`, async () => {
    const f = fixture()
    await f.restore({ time: 42, maxTime: 180 })
    f.state.playMusicInfo = { ...f.selected, musicInfo: { id } }
    f.timers.forEach(run => run())
    f.pic.resolve('stale-cover'); f.lyric.resolve({ lyric: 'stale lyrics', rawlrcInfo: { lyric: 'raw' } })
    await f.flush()
    assert.deepEqual(f.updates, [])
    assert.deepEqual(f.events, [])
  })
}

test('a late restore error cannot replace the new track status', async () => {
  const f = fixture()
  await f.restore({ time: 42, maxTime: 180 })
  f.state.playMusicInfo = { ...f.selected, musicInfo: { id: 'new' } }
  f.lyric.reject(Error('old request failed'))
  f.pic.resolve('stale-cover')
  await f.flush()
  assert.deepEqual(f.statuses, [])
})
