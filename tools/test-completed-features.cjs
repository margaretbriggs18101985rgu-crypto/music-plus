const assert = require('node:assert/strict')
const fs = require('node:fs')
const { createHash } = require('node:crypto')
const { test } = require('node:test')
const ts = require('typescript')

function load(file, dependencies = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(module, module.exports, id => {
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`)
    return dependencies[id]
  }, ...Object.values(globals))
  return module.exports
}
const flush = async() => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let fulfill; let fail; const promise = new Promise((resolve, reject) => { fulfill = resolve; fail = reject }); return { promise, resolve: fulfill, reject: fail } }

function storageEnvironment() {
  const env = { raw: new Map(), beforeSet: null }
  const asyncStorage = {
    getItem: async key => env.raw.get(key) ?? null,
    getAllKeys: async() => [...env.raw.keys()],
    multiGet: async keys => keys.map(key => [key, env.raw.get(key) ?? null]),
    multiSet: async pairs => { if (env.beforeSet) await env.beforeSet(pairs); for (const [key, value] of pairs) env.raw.set(key, value) },
    multiRemove: async keys => { for (const key of keys) env.raw.delete(key) },
    removeItem: async key => { env.raw.delete(key) },
    clear: async() => { env.raw.clear() },
  }
  env.restart = () => load('src/plugins/storage.ts', {
    '@react-native-async-storage/async-storage': { default: asyncStorage },
    '@/utils/log': { log: { error() {} } },
  })
  env.api = env.restart()
  return env
}

test('serialized storage writes preserve the latest fragmented value and snapshots expand logical records', async() => {
  const env = storageEnvironment()
  const first = '甲'.repeat(600000)
  const second = '乙'.repeat(600001)
  await Promise.all([env.api.saveData('@lyric__a', first), env.api.saveData('@lyric__a', second), env.api.saveData('device', 1)])
  assert.equal(await env.api.getData('@lyric__a'), second)
  assert.deepEqual(await env.api.getLogicalStorageSnapshot(key => key.startsWith('@lyric__')), [['@lyric__a', second]])
  assert.equal([...env.raw.keys()].filter(key => key.startsWith('@___PART_A___')).length, 2)
})

test('snapshot replacement removes obsolete records, preserves device data, and holds stale writes until restart', async() => {
  const env = storageEnvironment()
  await env.api.saveDataMultiple([['@user', 'old'], ['@obsolete', 'x'.repeat(600000)], ['device', 'permission']])
  await env.api.replaceStorageSnapshot([['@user', 'new']], key => key.startsWith('@') && !key.startsWith('@musicplus'))
  env.api.saveData('@user', 'stale in-memory data').catch(assert.fail)
  await flush()
  const fresh = env.restart()
  await fresh.recoverPendingStorageRestore()
  assert.equal(await fresh.getData('@user'), 'new')
  assert.equal(await fresh.getData('@obsolete'), null)
  assert.equal(await fresh.getData('device'), 'permission')
  assert.ok(![...env.raw.keys()].some(key => key.startsWith('@___PART') || key.includes('restore_journal')))
  await fresh.saveData('@user', 'subsequent edit')
  assert.equal(await fresh.getData('@user'), 'subsequent edit')
})

test('a partially failed restore rolls back every old shard and remains writable', async() => {
  const env = storageEnvironment()
  await env.api.saveDataMultiple([['@user', 'old'], ['@big', 'x'.repeat(600000)], ['device', true]])
  const before = [...env.raw].sort()
  let failed = false
  env.beforeSet = async pairs => {
    if (!failed && pairs.some(([key, value]) => key == '@user' && value == '"new"')) {
      failed = true
      env.raw.set(...pairs[0])
      throw new Error('Disk full midway through write')
    }
  }
  await assert.rejects(env.api.replaceStorageSnapshot([['@user', 'new'], ['@big', 'y'.repeat(600000)]], key => ['@user', '@big'].includes(key)), /Disk full/)
  assert.deepEqual([...env.raw].sort(), before)
  await env.api.saveData('@user', 'still writable')
  assert.equal(await env.api.getData('@user'), 'still writable')
})

test('rollback failure retains a recovery journal, blocks stale writes, and recovers on next launch', async() => {
  const env = storageEnvironment()
  await env.api.saveDataMultiple([['@user', 'old'], ['@big', 'x'.repeat(600000)]])
  const before = [...env.raw].sort()
  env.beforeSet = async pairs => {
    if (pairs.some(([key]) => key == '@user')) { env.raw.set(...pairs[0]); throw new Error('Simulated power interruption') }
  }
  await assert.rejects(env.api.replaceStorageSnapshot([['@user', 'new']], key => ['@user', '@big'].includes(key)), { name: 'StorageRestoreRecoveryError' })
  assert.ok(env.raw.has('@musicplus_restore_journal'))
  env.api.saveData('@user', 'stale').catch(assert.fail)
  await flush()
  env.beforeSet = null
  const fresh = env.restart()
  await fresh.recoverPendingStorageRestore()
  await fresh.recoverPendingStorageRestore()
  assert.deepEqual([...env.raw].sort(), before)
  assert.equal(await fresh.getData('@big'), 'x'.repeat(600000))
})

const constants = load('src/config/constant.ts')
const defaults = load('src/config/defaultSetting.ts', { './builtinUserApi': { BUILTIN_USER_API_ID: 'builtin' } }).default
const hash = async text => createHash('sha256').update(text).digest('hex')
const song = id => ({ id, name: 'Song ' + id, source: 'wy', meta: { songId: id } })
async function backupEnvironment() {
  const storage = storageEnvironment()
  const env = { storage, files: new Map(), corruptFile: false, lists: { userList: [{ id: 'remote', name: 'Collected', source: 'wy', sourceListId: '42' }] }, settings: { setting: { ...defaults, 'player.volume': 0.7 } } }
  const songs = { default: [song('a')], love: [song('b')], temp: [], remote: [song('c')] }
  env.songs = songs
  env.api = load('src/core/backup.ts', {
    '../../package.json': { version: '1.1.2' },
    '@/config/constant': constants,
    '@/plugins/storage': storage.api,
    '@/utils/nativeModules/crypto': { hashSHA256: hash },
    '@/utils/fs': {
      writeFile: async(path, data) => { env.files.set(path, data) },
      readFile: async path => env.corruptFile ? 'corrupt' : env.files.get(path),
      stat: async path => ({ size: Buffer.byteLength(env.files.get(path)) }),
    },
    '@/store/list/state': { default: env.lists },
    '@/store/setting/state': { default: env.settings },
    '@/core/list': { getListMusics: async id => songs[id] ?? [] },
    '@/config/defaultSetting': { default: defaults },
  })
  await storage.api.saveDataMultiple([
    ['@setting_v1', { ...defaults, 'player.volume': 0.1 }],
    ['@lyric__a_edited', { lyric: '[00:01]Edited' }],
    ['@user_api__scripts', [{ script: 'user script' }]],
    ['musicplus_recent_tracks', [song('a')]],
    ['@sync_auth_key', 'secret'], ['@selected_managed_folder', 'device grant'],
    ['@music_url__a', 'expiring URL'], ['musicplus_download_jobs', [1234]],
  ])
  return env
}
async function seal(payload) { const text = JSON.stringify(payload); return { format: 'music-plus-backup', schema: 1, payload: text, sha256: await hash(text) } }

test('full backups capture live settings, playlists, edited lyrics, history and sources while excluding device credentials', async() => {
  const env = await backupEnvironment()
  Object.assign(env.settings.setting, {
    'theme.wallpaper.path': '/private/wallpapers/sample.mp4',
    'theme.wallpaper.name': 'sample.mp4',
    'theme.wallpaper.kind': 'video',
    'theme.wallpaper.scope': 'player',
  })
  const doc = await env.api.createBackup('full')
  const payload = await env.api.parseBackup(doc)
  const data = new Map(payload.entries)
  assert.equal(data.get('@setting_v1')['player.volume'], 0.7)
  assert.equal(data.get('@setting_v1')['theme.wallpaper.path'], '')
  assert.equal(data.get('@setting_v1')['theme.wallpaper.name'], '')
  assert.equal(data.get('@setting_v1')['theme.wallpaper.kind'], 'none')
  assert.equal(data.get('@setting_v1')['theme.wallpaper.scope'], 'player')
  assert.deepEqual(data.get('@list__remote'), env.songs.remote)
  assert.deepEqual(data.get('@user_list'), env.lists.userList)
  assert.ok(data.has('@list__temp'))
  assert.deepEqual(data.get('@lyric__a_edited'), { lyric: '[00:01]Edited' })
  assert.ok(data.has('@user_api__scripts') && data.has('musicplus_recent_tracks'))
  for (const key of ['@sync_auth_key', '@selected_managed_folder', '@music_url__a', 'musicplus_download_jobs']) assert.ok(!data.has(key))
  assert.equal(doc.sha256, await hash(doc.payload))
})

test('settings backup round trip replaces preferences without changing songs or edited lyrics', async() => {
  const env = await backupEnvironment()
  const payload = await env.api.parseBackup(await env.api.createBackup('settings'))
  assert.deepEqual(payload.entries.map(([key]) => key), ['@setting_v1'])
  await env.storage.api.saveDataMultiple([['@list__love', [song('keep')]], ['@theme', { stale: true }]])
  await env.api.restoreBackup(payload)
  const fresh = env.storage.restart()
  assert.deepEqual(await fresh.getData('@list__love'), [song('keep')])
  assert.equal((await fresh.getData('@setting_v1'))['player.volume'], 0.7)
  assert.deepEqual(await fresh.getData('@lyric__a_edited'), { lyric: '[00:01]Edited' })
  assert.equal(await fresh.getData('@theme'), null)
})

test('full backup round trip restores every collection and removes later portable records', async() => {
  const env = await backupEnvironment()
  const payload = await env.api.parseBackup(await env.api.createBackup('full'))
  await env.storage.api.saveDataMultiple([['@list__remote', []], ['@lyric__later_edited', { lyric: 'later' }]])
  await env.api.restoreBackup(payload)
  const fresh = env.storage.restart()
  assert.deepEqual(await fresh.getData('@list__remote'), env.songs.remote)
  assert.equal(await fresh.getData('@lyric__later_edited'), null)
  assert.equal(await fresh.getData('@sync_auth_key'), 'secret')
  assert.equal(await fresh.getData('@selected_managed_folder'), 'device grant')
})

test('tampered, unsupported and structurally invalid backups are rejected before any storage mutation', async() => {
  const env = await backupEnvironment()
  const doc = await env.api.createBackup('full')
  const before = [...env.storage.raw]
  await assert.rejects(env.api.parseBackup({ ...doc, payload: doc.payload + ' ' }), /校验失败/)
  await assert.rejects(env.api.parseBackup({ ...doc, schema: 999 }), /不受支持|不是受支持/)
  const original = JSON.parse(doc.payload)
  const cases = [
    [...original.entries, ['@sync_auth_key', 'overwrite device credentials']],
    [...original.entries, original.entries[0]],
    original.entries.filter(([key]) => key != '@list__remote'),
    original.entries.map(([key, value]) => [key, key == '@setting_v1' ? { ...value, 'player.volume': 'loud' } : value]),
    original.entries.map(([key, value]) => [key, key == '@list__love' ? [{ broken: true }] : value]),
    original.entries.map(([key, value]) => [key, key == '@user_list' ? [...value, ...value] : value]),
  ]
  for (const entries of cases) await assert.rejects(env.api.parseBackup(await seal({ ...original, entries })))
  assert.deepEqual([...env.storage.raw], before)
})

test('backup export verifies the saved file and read-back restores the exact payload', async() => {
  const env = await backupEnvironment()
  const path = await env.api.exportBackupFile('/chosen', 'full')
  assert.match(path, /^\/chosen\/music-plus-full-\d+\.json$/)
  assert.equal((await env.api.readBackupFile(path)).kind, 'full')
  env.corruptFile = true
  await assert.rejects(env.api.exportBackupFile('/chosen', 'settings'), /写入校验失败/)
})

function lyricEnvironment() {
  const track = song('a')
  const env = {
    track,
    state: { playMusicInfo: { musicInfo: track }, musicInfo: { rawlrc: '[00:00]Raw', lrc: '[00:00]Old' }, isPlay: false },
    edited: new Map([['other', { lyric: '[00:00]Other' }]]),
    raw: { lyric: '[00:00]Raw' },
    sync: [],
    applied: 0,
    saveWait: null,
    readWait: null,
    positionWait: null,
  }
  env.api = load('src/core/lyricEditor.ts', {
    '@/utils/data': {
      saveEditedLyric: async(track, info) => { if (env.saveWait) await env.saveWait.promise; env.edited.set(track.id, info) },
      clearEditedLyric: async track => { env.edited.delete(track.id) },
      getPlayerLyric: async() => { if (env.readWait) await env.readWait.promise; return { rawlrcInfo: env.raw } },
    },
    '@/store/player/state': { default: env.state },
    '@/store/player/action': { default: { setMusicInfo: info => Object.assign(env.state.musicInfo, info) } },
    '@/core/lyric': { setLyric: async() => { env.applied++ }, syncPosition: (time, force) => { env.sync.push([time, force]) } },
    '@/plugins/player': { getPosition: async() => { if (env.positionWait) await env.positionWait.promise; return 12.5 } },
  })
  return env
}

test('edited timed lyrics save all tracks of text, update the current lyric clock, and preserve paused playback', async() => {
  const env = lyricEnvironment()
  const info = { lyric: '[00:12.34]Text', tlyric: '[00:12.34]翻译', rlyric: '[00:12.34]roma' }
  assert.equal(await env.api.saveCurrentEditedLyric(env.track, info), true)
  assert.deepEqual(env.edited.get('a'), info)
  assert.equal(env.state.musicInfo.lrc, info.lyric)
  assert.equal(env.state.musicInfo.lxlrc, null)
  assert.deepEqual(env.sync, [[12.5, true]])
  assert.equal(env.state.isPlay, false)
})

test('invalid, untimed and oversized lyrics cannot overwrite an edited copy', async() => {
  const env = lyricEnvironment()
  for (const info of [{ lyric: 'no time' }, { lyric: '[00:01]ok', tlyric: 'untimed' }, { lyric: '[00:01]' + 'x'.repeat(200001) }]) {
    await assert.rejects(env.api.saveCurrentEditedLyric(env.track, info))
  }
  assert.ok(!env.edited.has('a'))
  assert.equal(env.applied, 0)
})

test('a track change during lyric persistence saves the original song without applying to the new song', async() => {
  const env = lyricEnvironment()
  env.saveWait = deferred()
  const save = env.api.saveCurrentEditedLyric(env.track, { lyric: '[00:01]A' })
  env.state.playMusicInfo.musicInfo = song('b')
  env.saveWait.resolve()
  assert.equal(await save, false)
  assert.equal(env.edited.get('a').lyric, '[00:01]A')
  assert.equal(env.applied, 0)
  assert.ok(!env.edited.has('b'))
  await assert.rejects(env.api.saveCurrentEditedLyric(env.track, { lyric: '[00:01]A' }), /歌曲已切换/)
})

test('a track change while fetching the audio position never seeks the new lyrics', async() => {
  const env = lyricEnvironment()
  env.positionWait = deferred()
  const save = env.api.saveCurrentEditedLyric(env.track, { lyric: '[00:01]A' })
  await flush()
  env.state.playMusicInfo.musicInfo = song('b')
  env.positionWait.resolve()
  assert.equal(await save, false)
  assert.deepEqual(env.sync, [])
})

test('lyric reset removes only this song edit and clears the display when the raw lyric is empty', async() => {
  const env = lyricEnvironment()
  await env.api.saveCurrentEditedLyric(env.track, { lyric: '[00:01]Edited' })
  env.raw = { lyric: '' }
  env.state.musicInfo.rawlrc = ''
  await env.api.resetCurrentEditedLyric(env.track)
  assert.ok(!env.edited.has('a'))
  assert.ok(env.edited.has('other'))
  assert.equal(env.state.musicInfo.lrc, '')
  assert.equal(env.applied, 2)
})

test('a track change during reset prevents using the next song raw lyrics or deleting an edit', async() => {
  const env = lyricEnvironment()
  env.edited.set('a', { lyric: '[00:01]Edited' })
  env.readWait = deferred()
  const reset = env.api.resetCurrentEditedLyric(env.track)
  env.state.playMusicInfo.musicInfo = song('b')
  env.state.musicInfo.rawlrc = 'new song raw'
  env.readWait.resolve()
  await assert.rejects(reset, /歌曲已切换/)
  assert.ok(env.edited.has('a'))
  assert.equal(env.applied, 0)
})

function syncEnvironment() {
  const remote = { id: 'remote', name: 'Collection', source: 'wy', sourceListId: '42' }
  const env = { remote, state: { userList: [remote] }, result: [song('new')], fetches: 0, saved: [], times: [], statuses: [], fetchWait: null, writeWait: null, writeError: null }
  env.api = load('src/core/syncSourceList.ts', {
    '@/utils/data': { setListUpdateTime: async(id, time) => { env.times.push([id, time]) } },
    './list': {
      overwriteListMusics: async(id, list) => { if (env.writeWait) await env.writeWait.promise; if (env.writeError) throw env.writeError; env.saved.push([id, list]) },
      setFetchingListStatus: (id, value) => { env.statuses.push([id, value]) },
    },
    '@/core/songlist': { getListDetailAll: async() => { env.fetches++; if (env.fetchWait) await env.fetchWait.promise; return env.result } },
    '@/core/leaderboard': { getListDetailAll: async id => { env.fetches++; assert.equal(id, 'top'); return env.result } },
    '@/store/list/state': { default: env.state },
  }).default
  return env
}

test('concurrent manual and automatic collection sync share one fetch and await persistence before success', async() => {
  const env = syncEnvironment()
  env.fetchWait = deferred(); env.writeWait = deferred()
  const first = env.api({ ...env.remote }, { automatic: true })
  const second = env.api({ ...env.remote })
  env.fetchWait.resolve()
  await flush()
  assert.equal(env.fetches, 1)
  assert.deepEqual(env.times, [])
  env.writeWait.resolve()
  assert.deepEqual(await Promise.all([first, second]), [true, true])
  assert.equal(env.saved.length, 1)
  assert.equal(env.times.length, 1)
})

test('sync cannot recreate deleted collections, overwrite rebound lists, or ignore a disabled switch', async() => {
  for (const mode of ['deleted', 'rebound', 'disabled']) {
    const env = syncEnvironment()
    env.fetchWait = deferred()
    const task = env.api({ ...env.remote }, { shouldApply: () => mode != 'disabled' })
    if (mode == 'deleted') env.state.userList = []
    if (mode == 'rebound') env.remote.sourceListId = 'different'
    env.fetchWait.resolve()
    assert.equal(await task, false)
    assert.deepEqual(env.saved, [])
    assert.deepEqual(env.times, [])
  }
})

test('automatic empty responses preserve songs while explicit manual sync can accept an empty playlist', async() => {
  const env = syncEnvironment()
  env.result = []
  assert.equal(await env.api(env.remote, { automatic: true }), false)
  assert.deepEqual(env.saved, [])
  assert.equal(await env.api(env.remote), true)
  assert.deepEqual(env.saved, [['remote', []]])
})

test('invalid responses and failed playlist writes do not advance the last successful sync', async() => {
  const env = syncEnvironment()
  env.result = { error: 'remote rejected request' }
  await assert.rejects(env.api(env.remote), /Invalid remote/)
  env.result = [song('valid')]
  env.writeError = new Error('Disk full')
  await assert.rejects(env.api(env.remote), /Disk full/)
  assert.deepEqual(env.times, [])
  env.writeError = null
  assert.equal(await env.api(env.remote), true)
})

test('collected charts use the chart endpoint rather than the songlist endpoint', async() => {
  const env = syncEnvironment()
  env.remote.sourceListId = 'board__top'
  assert.equal(await env.api(env.remote), true)
  assert.equal(env.fetches, 1)
})

function autoEnvironment() {
  const remote = { id: 'remote', name: 'Collection', source: 'wy', sourceListId: '42' }
  const env = { now: 1000000000, state: { currentState: 'active' }, lists: { userList: [remote] }, info: {}, calls: [], listeners: [], timers: [], confirmations: [], messages: [], confirmed: true, fail: false, wait: null }
  env.api = load('src/core/autoListSync.ts', {
    'react-native': { AppState: Object.assign(env.state, { addEventListener: (name, fn) => { env.listeners.push(fn) } }) },
    '@/store/list/state': { default: env.lists },
    '@/utils/data': {
      getListUpdateInfo: async() => env.info,
      setListAutoUpdate: async(id, enable) => { env.info[id] = { updateTime: 0, ...env.info[id], isAutoUpdate: enable } },
    },
    './syncSourceList': {
      default: async(item, options) => {
        env.calls.push({ item, options })
        if (env.wait) await env.wait.promise
        if (env.fail) throw new Error('offline')
        if (options.shouldApply()) env.info[item.id].updateTime = env.now
      },
    },
    '@/utils/tools': { confirmDialog: async value => { env.confirmations.push(value); return env.confirmed }, toast: message => { env.messages.push(message) } },
  }, { Date: { now: () => env.now }, setInterval: (fn, delay) => { env.timers.push({ fn, delay }) }, console: { warn() {} } })
  return env
}

test('auto sync is opt-in, requires a bound source and waits six hours after a successful refresh', async() => {
  const env = autoEnvironment()
  await env.api.checkAutoListSync()
  assert.equal(env.calls.length, 0)
  env.info.remote = { isAutoUpdate: true, updateTime: env.now - 6 * 3600000 }
  env.lists.userList.push({ id: 'local', name: 'Local' })
  env.info.local = { isAutoUpdate: true, updateTime: 0 }
  await env.api.checkAutoListSync()
  assert.equal(env.calls.length, 1)
  env.now += 5 * 3600000
  await env.api.checkAutoListSync()
  assert.equal(env.calls.length, 1)
  env.now += 3600000
  await env.api.checkAutoListSync()
  assert.equal(env.calls.length, 2)
})

test('failed auto sync retries after fifteen minutes and background checks never run', async() => {
  const env = autoEnvironment()
  env.info.remote = { isAutoUpdate: true, updateTime: 0 }
  env.fail = true
  await env.api.checkAutoListSync()
  env.now += 14 * 60000
  await env.api.checkAutoListSync()
  assert.equal(env.calls.length, 1)
  env.now += 60000
  env.state.currentState = 'background'
  await env.api.checkAutoListSync()
  assert.equal(env.calls.length, 1)
  env.state.currentState = 'active'
  await env.api.checkAutoListSync()
  assert.equal(env.calls.length, 2)
})

test('auto sync startup installs a single foreground listener and timer', async() => {
  const env = autoEnvironment()
  env.api.startAutoListSync(); env.api.startAutoListSync()
  await flush()
  assert.equal(env.listeners.length, 1)
  assert.equal(env.timers.length, 1)
  assert.equal(env.timers[0].delay, 15 * 60000)
  env.info.remote = { isAutoUpdate: true, updateTime: 0 }
  env.state.currentState = 'background'
  env.timers[0].fn()
  await flush()
  assert.equal(env.calls.length, 0)
  env.state.currentState = 'active'
  env.listeners[0]('active')
  await flush()
  assert.equal(env.calls.length, 1)
})

test('enabling auto sync explains replacement, respects cancellation, persists the switch and disabling invalidates a pending response', async() => {
  const env = autoEnvironment()
  const item = env.lists.userList[0]
  env.confirmed = false
  await env.api.toggleAutoListSync(item)
  assert.equal(env.info.remote, undefined)
  env.confirmed = true
  env.wait = deferred()
  await env.api.toggleAutoListSync(item)
  await flush()
  assert.equal(env.info.remote.isAutoUpdate, true)
  assert.equal(env.calls.length, 1)
  assert.match(env.confirmations[1].message, /替换/)
  await env.api.toggleAutoListSync(item)
  assert.equal(env.info.remote.isAutoUpdate, false)
  assert.equal(env.calls[0].options.shouldApply(), false)
  env.wait.resolve()
  await flush()
  assert.equal(env.info.remote.updateTime, 0)
  assert.equal(env.confirmations.length, 2)
})

function dataEnvironment(storage) {
  return load('src/utils/data.ts', {
    '@/plugins/storage': storage.api,
    '@/config/constant': constants,
    './common': { throttle: fn => fn },
    '@/config/builtinUserApi': { BUILTIN_USER_API: {}, BUILTIN_USER_API_ID: 'builtin', builtinUserApiScript: '' },
  })
}

test('concurrent playlist switch and timestamp saves merge and a failed save never changes the cached switch', async() => {
  const storage = storageEnvironment()
  const data = dataEnvironment(storage)
  const info = await data.getListUpdateInfo()
  await Promise.all([data.setListAutoUpdate('remote', true), data.setListUpdateTime('remote', 12345)])
  assert.deepEqual(info.remote, { isAutoUpdate: true, updateTime: 12345 })
  assert.deepEqual(await storage.api.getData('@list_update_info'), info)
  storage.beforeSet = async() => { throw new Error('Disk full') }
  await assert.rejects(data.setListAutoUpdate('remote', false), /Disk full/)
  assert.equal(info.remote.isAutoUpdate, true)
})

test('real lyric storage prefers saved edits across restart and targeted reset leaves other song edits intact', async() => {
  const storage = storageEnvironment()
  let data = dataEnvironment(storage)
  const track = song('a')
  await data.saveLyric(track, { lyric: '[00:01]Raw' })
  await data.saveEditedLyric(track, { lyric: '[00:02]Edited', tlyric: '[00:02]翻译' })
  await data.saveEditedLyric(song('b'), { lyric: '[00:03]B' })
  storage.api = storage.restart()
  data = dataEnvironment(storage)
  const loaded = await data.getPlayerLyric(track)
  assert.equal(loaded.lyric, '[00:02]Edited')
  assert.equal(loaded.rawlrcInfo.lyric, '[00:01]Raw')
  await data.clearEditedLyric(track)
  assert.equal((await data.getPlayerLyric(track)).lyric, '[00:01]Raw')
  assert.equal((await data.getPlayerLyric(song('b'))).lyric, '[00:03]B')
})

const jsx = (type, props) => ({ type, props })
function listMenuUI() {
  const env = { hooks: [], cursor: 0, info: {}, wait: null, toggles: [], lists: { fetchingListStatus: {} } }
  const ref = { current: null }
  const component = load('src/screens/Home/Views/Mylist/MyList/ListMenu.tsx', {
    react: {
      useRef: initial => {
        const index = env.cursor++
        if (!env.hooks[index]) env.hooks[index] = { current: initial }
        return env.hooks[index]
      },
      useState: initial => {
        const index = env.cursor++
        if (!(index in env.hooks)) env.hooks[index] = initial
        return [env.hooks[index], next => { env.hooks[index] = next }]
      },
      useImperativeHandle: (target, create) => { target.current = create() },
      forwardRef: value => value,
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/lang': { useI18n: () => value => value },
    '@/components/common/Menu': { default: 'Menu' },
    '@/config/constant': constants,
    '@/utils/musicSdk': { default: { wy: { songList: {} } } },
    '@/utils/pixelRatio': { scaleSizeW: value => value },
    '@/store/list/state': { default: env.lists },
    '@/utils/data': { getListUpdateInfo: async() => { if (env.wait) await env.wait.promise; return env.info } },
    '@/core/autoListSync': { toggleAutoListSync: async item => { env.toggles.push(item) } },
    '@/utils/tools': { toast: assert.fail },
  }, { requestAnimationFrame: callback => callback() }).default
  env.render = () => { env.cursor = 0; return component({}, ref) }
  env.render()
  env.hooks[0].current = { show() {} }
  env.show = item => ref.current.show({ listInfo: item, index: 0 }, { x: 0, y: 0, w: 1, h: 1 })
  return env
}

test('remote playlist menus expose auto sync and allow switching it off while a fetch is pending', async() => {
  const env = listMenuUI()
  const remote = { id: 'remote', name: 'Collection', source: 'wy', sourceListId: '42' }
  for (const enabled of [false, true]) {
    env.info.remote = { isAutoUpdate: enabled, updateTime: 0 }
    env.lists.fetchingListStatus.remote = true
    env.show(remote)
    await flush()
    const menu = env.render()
    const item = menu.props.menus.find(item => item.action == 'autoSync')
    assert.equal(item.disabled, false)
    assert.equal(item.label, enabled ? '关闭自动同步' : '开启自动同步')
    menu.props.onPress(item)
    await flush()
    assert.equal(env.toggles.at(-1), remote)
  }
  env.show({ id: constants.LIST_IDS.DEFAULT, name: 'Local' })
  await flush()
  assert.equal(env.render().props.menus.find(item => item.action == 'autoSync').disabled, true)
})

test('switching playlist menus clears old actions while preferences load and ignores late results for another list', async() => {
  const env = listMenuUI()
  env.show({ id: 'one', name: 'One', source: 'wy', sourceListId: '1' })
  await flush()
  assert.ok(env.render().props.menus.some(item => item.action == 'autoSync' && !item.disabled))
  env.wait = deferred()
  env.show({ id: 'two', name: 'Two', source: 'wy', sourceListId: '2' })
  env.show({ id: constants.LIST_IDS.DEFAULT, name: 'Local' })
  assert.deepEqual(env.render().props.menus, [])
  env.wait.resolve()
  await flush()
  assert.equal(env.render().props.menus.find(item => item.action == 'autoSync').disabled, true)
})

function nodes(root) {
  if (Array.isArray(root)) return root.flatMap(nodes)
  if (!root || typeof root != 'object') return []
  return [root, ...nodes(root.props?.children)]
}
function backupUI() {
  const env = { refs: [], states: [], selected: [], calls: [], kind: 'full', confirmed: true, restoreError: null }
  const component = load('src/screens/Home/Views/Setting/settings/Backup/CompleteBackup.tsx', {
    react: { useRef: current => { const ref = { current }; env.refs.push(ref); return ref }, useState: value => [value, next => { env.states.push(next) }] },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Modal: 'Modal', View: 'View' },
    '@/components/common/ChoosePath': { default: 'ChoosePath' },
    '@/components/common/Text': { default: 'Text' },
    '@/store/theme/hook': { useTheme: () => ({}) },
    '@/utils/tools': {
      confirmDialog: async() => { env.calls.push('confirm'); return env.confirmed },
      tipDialog: async() => { env.calls.push('restart prompt') },
      toast: message => { env.calls.push(message) },
    },
    '@/utils/nativeModules/utils': { exitApp: () => { env.calls.push('exit') } },
    '@/core/backup': {
      exportBackupFile: async(path, kind) => { env.calls.push(['export', path, kind]) },
      readBackupFile: async path => { env.calls.push(['read', path]); return { kind: env.kind } },
      restoreBackup: async payload => { if (env.restoreError) throw env.restoreError; env.calls.push(['restore', payload.kind]) },
    },
    '@/core/player/player': { pause: async() => { env.calls.push('pause') } },
    '@/store/player/state': { default: { isPlay: false } },
    '../../components/SubTitle': { default: 'SubTitle' },
    '../../components/Button': { default: 'Button' },
  }).default
  const tree = component()
  env.refs[0].current = { show: options => { env.selected.push(options) } }
  env.button = label => nodes(tree).find(node => node.type == 'Button' && node.props.children == label)
  env.choose = path => nodes(tree).find(node => node.type == 'ChoosePath').props.onConfirm(path)
  return env
}

test('all four backup UI buttons open the appropriate file or directory picker and dispatch the selected action', async() => {
  for (const [label, kind, action] of [['导出设置', 'settings', 'export'], ['恢复设置', 'settings', 'import'], ['导出完整备份', 'full', 'export'], ['恢复完整备份', 'full', 'import']]) {
    const env = backupUI()
    env.kind = kind
    env.button(label).props.onPress()
    assert.equal(env.selected[0].dirOnly, action == 'export')
    env.choose('/chosen')
    await flush()
    if (action == 'export') assert.deepEqual(env.calls[0], ['export', '/chosen', kind])
    else {
      assert.deepEqual(env.calls, [['read', '/chosen'], 'confirm', ['restore', kind], 'restart prompt', 'exit'])
      assert.deepEqual(env.states, [true])
      env.button('导出设置').props.onPress()
      assert.equal(env.selected.length, 1)
    }
  }
})

test('cancelled and mismatched backup imports never pause or replace data', async() => {
  for (const mode of ['cancel', 'mismatch']) {
    const env = backupUI()
    env.confirmed = mode != 'cancel'
    env.kind = mode == 'mismatch' ? 'settings' : 'full'
    env.button('恢复完整备份').props.onPress()
    env.choose('/backup.json')
    await flush()
    assert.ok(!env.calls.some(call => call == 'pause' || call == 'exit' || (Array.isArray(call) && call[0] == 'restore')))
    assert.deepEqual(env.states, [true, false])
  }
})

test('an incomplete storage rollback requires restarting from the backup UI and keeps interactions blocked', async() => {
  const env = backupUI()
  env.restoreError = Object.assign(new Error('Restart to recover old data'), { name: 'StorageRestoreRecoveryError' })
  env.button('恢复完整备份').props.onPress()
  env.choose('/backup.json')
  await flush()
  assert.deepEqual(env.calls, [['read', '/backup.json'], 'confirm', 'restart prompt', 'exit'])
  assert.deepEqual(env.states, [true])
})

test('the desktop unplayed color UI validates input and changes only that color before persisting it', async() => {
  const calls = []
  const component = load('src/screens/Home/Views/Setting/settings/LyricDesktop/Theme.tsx', {
    '@/core/common': { updateSetting: value => { calls.push(value) } },
    '@/core/desktopLyric': { setDesktopLyricColor: async(...args) => { calls.push(args) } },
    '@/lang': { useI18n: () => text => text },
    react: { memo: value => value },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { StyleSheet: { create: value => value }, View: 'View', TouchableOpacity: 'TouchableOpacity' },
    '../../components/SubTitle': { default: 'SubTitle' },
    '../../components/InputItem': { default: 'InputItem' },
    '@/store/setting/hook': { useSettingValue: () => '#123456' },
    '@/utils/tools': { toast: value => { calls.push(value) } },
    '@/utils/lyricAppearance': load('src/utils/lyricAppearance.ts'),
  }).default
  const input = nodes(component()).find(node => node.type == 'InputItem')
  const reset = value => { calls.push(['reset', value]) }
  input.props.onChanged('invalid', reset)
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[1], ['reset', '#123456'])
  calls.length = 0
  input.props.onChanged('#abc', reset)
  await flush()
  assert.deepEqual(calls, [['#AABBCC', null, null], { 'desktopLyric.style.lyricUnplayColor': '#AABBCC' }, ['reset', '#AABBCC']])
})
