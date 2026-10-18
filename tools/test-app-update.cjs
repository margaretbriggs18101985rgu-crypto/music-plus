const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')

function load(file, dependencies, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  // Evaluate transpiled application modules with isolated native and clock substitutes.
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', ...Object.keys(globals), output)(module, module.exports, id => {
    assert.ok(id in dependencies, `Unexpected dependency: ${id}`)
    return dependencies[id]
  }, ...Object.values(globals))
  return module.exports
}

function core(ignored = null) {
  const state = {
    showModal: false,
    ignoreVersion: ignored,
    progress: {},
    versionInfo: {
      version: '1.1.2', newVersion: null, isLatest: false, isUnknown: false, status: 'checking',
    },
  }
  const env = {
    state,
    ignored,
    now: 1700000000000,
    calls: 0,
    overlays: 0,
    downloads: 0,
    installs: 0,
    toasts: [],
    listeners: [],
    timers: [],
    remote: { version: '1.1.3', desc: 'Update', history: [] },
    appState: { currentState: 'active' },
  }
  env.appState.addEventListener = (_event, callback) => { env.listeners.push(callback); return { remove() {} } }
  const actions = {
    setVersionInfo: info => Object.assign(state.versionInfo, info),
    setIgnoreVersion: value => { state.ignoreVersion = value },
    setVisibleModal: value => { state.showModal = value },
    setProgress: value => { state.progress = value },
  }
  env.api = load('src/core/version.ts', {
    'react-native': { AppState: env.appState },
    '@/utils': { compareVer: (a, b) => a.localeCompare(b, 'en', { numeric: true }) },
    '@/utils/version': {
      getVersionInfo: async() => { env.calls++; if (env.fetchError) throw Error('offline'); return env.pending || env.remote },
      downloadNewVersion: async(_version, progress) => { env.downloads++; progress(100, 50); if (env.downloadError) throw Error('download'); if (env.downloadPending) await env.downloadPending },
      updateApp: async() => { env.installs++; if (env.installError) throw Error('denied') },
    },
    '@/store/version/action': { default: actions },
    '@/store/version/state': { default: state },
    '@/utils/data': { getIgnoreVersion: async() => env.ignored, saveIgnoreVersion: value => { env.ignored = value } },
    '@/navigation': { showVersionModal: () => { env.overlays++ } },
    'react-native-navigation': { Navigation: { dismissOverlay: async() => {} } },
    '@/utils/tools': { toast: value => env.toasts.push(value) },
  }, { Date: { now: () => env.now }, setInterval: fn => { env.timers.push(fn) }, global: { i18n: { t: key => key } } })
  env.settle = () => new Promise(resolve => setImmediate(resolve))
  env.foreground = async() => {
    env.appState.currentState = 'active'
    for (const listener of env.listeners) listener('active')
    await env.settle()
  }
  return env
}

test('a successful latest check does not hide a later new release', async() => {
  const env = core()
  env.remote.version = '1.1.2'
  await env.api.checkUpdate()
  assert.equal(env.state.versionInfo.isLatest, true)
  env.now += 16 * 60000
  env.remote.version = '1.1.3'
  await env.api.checkUpdate()
  assert.equal(env.state.versionInfo.isLatest, false)
  assert.equal(env.overlays, 1)
  assert.equal(env.downloads, 0)
  assert.equal(env.installs, 0)
})

test('skip saves only this version, survives restart, and a newer release still prompts', async() => {
  const original = core()
  await original.api.checkUpdate()
  original.api.setIgnoreVersion('1.1.3')
  original.api.hideModal('update')
  assert.equal(original.ignored, '1.1.3')
  const restarted = core(original.ignored)
  await restarted.api.checkUpdate()
  assert.equal(restarted.overlays, 0)
  restarted.now += 16 * 60000
  restarted.remote.version = '1.1.4'
  await restarted.api.checkUpdate()
  assert.equal(restarted.overlays, 1)
})

test('manual settings check bypasses ignored version and cooldown without downloading', async() => {
  const env = core('1.1.3')
  await env.api.checkUpdate()
  await env.api.checkUpdate({ manual: true })
  assert.equal(env.calls, 2)
  assert.equal(env.overlays, 1)
  assert.equal(env.state.versionInfo.newVersion.version, '1.1.3')
  assert.equal(env.downloads, 0)
})

test('cancel closes the prompt without ignoring or repeatedly prompting the same session', async() => {
  const env = core()
  await env.api.checkUpdate()
  env.api.hideModal('update')
  env.now += 16 * 60000
  await env.api.checkUpdate()
  assert.equal(env.overlays, 1)
  assert.equal(env.state.showModal, false)
  assert.equal(env.ignored, null)
  assert.equal(env.downloads, 0)
})

test('startup, foreground and periodic checks share one listener and apply cooldown', async() => {
  const env = core()
  env.remote.version = '1.1.2'
  env.api.startAutoUpdateCheck()
  env.api.startAutoUpdateCheck()
  await env.settle()
  assert.equal(env.listeners.length, 1)
  assert.equal(env.timers.length, 1)
  await env.foreground()
  assert.equal(env.calls, 1)
  env.now += 16 * 60000
  await env.foreground()
  assert.equal(env.calls, 2)
  env.appState.currentState = 'background'
  env.timers[0]()
  await env.settle()
  assert.equal(env.calls, 2)
})

test('an in-flight response does not open a background popup; foreground shows cached update', async() => {
  const env = core()
  let completeCheck
  env.pending = new Promise(resolve => { completeCheck = resolve })
  const check = env.api.checkUpdate()
  env.appState.currentState = 'background'
  completeCheck(env.remote)
  await check
  assert.equal(env.overlays, 0)
  env.appState.currentState = 'active'
  await env.api.checkUpdate()
  assert.equal(env.overlays, 1)
  assert.equal(env.calls, 1)
})

test('parallel checks share a request, automatic errors stay quiet, manual retry shows failure', async() => {
  const env = core()
  let failCheck
  env.pending = new Promise((_resolve, reject) => { failCheck = reject })
  const first = env.api.checkUpdate()
  const second = env.api.checkUpdate()
  failCheck(Error('offline'))
  await Promise.all([first, second])
  assert.equal(env.calls, 1)
  assert.equal(env.overlays, 0)
  assert.deepEqual(env.toasts, [])
  env.pending = null
  env.fetchError = true
  await env.api.checkUpdate({ manual: true })
  assert.equal(env.state.versionInfo.isUnknown, true)
  assert.equal(env.state.versionInfo.status, 'error')
  assert.equal(env.overlays, 1)
})

test('checking during a download preserves progress and cannot start a second download', async() => {
  const env = core()
  await env.api.checkUpdate()
  let complete
  env.downloadPending = new Promise(resolve => { complete = resolve })
  const download = env.api.downloadUpdate()
  await env.api.checkUpdate({ manual: true })
  await env.api.downloadUpdate()
  assert.equal(env.state.versionInfo.status, 'downloading')
  assert.deepEqual(env.state.progress, { total: 100, current: 50 })
  assert.equal(env.downloads, 1)
  complete()
  await download
  assert.equal(env.state.versionInfo.status, 'downloaded')
  assert.equal(env.installs, 1)
})

test('background download completion waits for user installation and does not nag after cancel', async() => {
  const env = core()
  await env.api.checkUpdate()
  env.api.hideModal('update')
  env.appState.currentState = 'background'
  await env.api.downloadUpdate()
  assert.equal(env.installs, 0)
  env.appState.currentState = 'active'
  await env.api.checkUpdate()
  assert.equal(env.state.showModal, true)
  env.api.hideModal('update')
  await env.api.checkUpdate()
  assert.equal(env.state.showModal, false)
  env.installError = true
  await env.api.installDownloadedUpdate()
  assert.equal(env.state.versionInfo.status, 'downloaded')
  assert.equal(env.toasts.length, 1)
  env.installError = false
  await env.api.installDownloadedUpdate()
  assert.equal(env.installs, 2)
})

function updater({ abi = 'universal', status = 200, digest = 'a'.repeat(64), permission = true, granted = true } = {}) {
  const env = { urls: [], removed: [], installed: 0, permissions: 0 }
  env.api = load('src/utils/version.js', {
    '@/utils/request': {
      httpGet: (url, _options, callback) => {
        env.urls.push(url)
        const body = env.response ? env.response(url) : `${'a'.repeat(64)}  music-plus-v1.1.3-${abi}.apk\n`
        if (body instanceof Error) callback(body)
        else callback(null, { statusCode: 200 }, body)
      },
    },
    '../../package.json': { repository: { url: 'git+https://github.com/owner/music-plus.git' }, name: 'music-plus' },
    '@/utils/fs': {
      temporaryDirectoryPath: '/cache',
      existsFile: async() => true,
      hash: async() => digest,
      unlink: async path => { env.removed.push(path) },
      downloadFile: url => { env.urls.push(url); return { promise: Promise.resolve({ statusCode: status, bytesWritten: 100 }) } },
    },
    '@/utils/nativeModules/utils': {
      getInstalledApkAbi: async() => abi,
      installApk: async() => { env.installed++ },
      canInstallPackages: async() => permission,
      requestPackageInstallPermission: async() => { env.permissions++; return granted },
    },
    '@/config/constant': { APP_PROVIDER_NAME: 'io.github.musicplus.player.provider' },
  })
  return env
}

for (const abi of ['universal', 'armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64']) {
  test(`downloads the installed ${abi} variant, verifies SHA256, and only installs on request`, async() => {
    const env = updater({ abi })
    await env.api.downloadNewVersion('1.1.3')
    assert.match(env.urls[1], new RegExp(`-${abi}\\.apk$`))
    assert.equal(env.installed, 0)
    await env.api.updateApp()
    assert.equal(env.installed, 1)
  })
}

test('HTTP failure, checksum mismatch and missing checksum never reach the installer', async() => {
  for (const options of [{ status: 404 }, { digest: 'b'.repeat(64) }, {}]) {
    const env = updater(options)
    if (!Object.keys(options).length) env.response = () => 'invalid manifest'
    await assert.rejects(env.api.downloadNewVersion('1.1.3'))
    await assert.rejects(env.api.updateApp())
    assert.equal(env.installed, 0)
    assert.equal(env.removed.length, 1)
  }
})

test('permission denial retains verified download for a later explicit retry', async() => {
  const env = updater({ permission: false, granted: false })
  await env.api.downloadNewVersion('1.1.3')
  await assert.rejects(env.api.updateApp(), /permission denied/)
  assert.equal(env.permissions, 1)
  assert.equal(env.installed, 0)
  assert.equal(env.removed.length, 0)
})

test('a complete published Release overrides a stale version manifest', async() => {
  const env = updater()
  env.response = () => ({
    tag_name: 'v1.1.3',
    body: 'Release notes',
    assets: [
      ...['universal', 'arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'].map(abi => ({ name: `music-plus-v1.1.3-${abi}.apk`, size: 100 })),
      { name: 'SHA256SUMS.txt', size: 100 },
    ],
  })
  const info = await env.api.getVersionInfo()
  assert.equal(info.version, '1.1.3')
  assert.equal(info.desc, 'Release notes')
  assert.equal(env.urls.length, 1)
})

test('incomplete or unavailable releases fall back to the verified legacy manifest', async() => {
  for (const release of [{ tag_name: 'v1.1.3', assets: [] }, Error('rate limit')]) {
    const env = updater()
    env.response = url => url.includes('api.github.com') ? release : { version: '1.1.2', desc: 'Verified' }
    assert.equal((await env.api.getVersionInfo()).version, '1.1.2')
    assert.equal(env.urls.length, 2)
  }
})

test('invalid remote versions and invalid download versions are rejected', async() => {
  const env = updater()
  env.response = () => ({ version: '../bad', desc: 'Invalid' })
  await assert.rejects(env.api.getVersionInfo())
  await assert.rejects(env.api.downloadNewVersion('../bad'))
  assert.equal(env.installed, 0)
})
