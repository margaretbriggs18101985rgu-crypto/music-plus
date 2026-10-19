const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { test } = require('node:test')

const root = path.resolve(__dirname, '..')
const source = ts.transpileModule(fs.readFileSync(path.join(root, 'src/plugins/player/cache.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText
const moduleRecord = { exports: {} }
new Function('module', 'exports', source)(moduleRecord, moduleRecord.exports) // eslint-disable-line no-new-func
const { DEFAULT_PLAYER_CACHE_SIZE_MIB, MAX_PLAYER_CACHE_SIZE_MIB, normalizePlayerCacheSize } = moduleRecord.exports

function loadPlayerIndex(trackPlayer, cacheSize) {
  const indexSource = ts.transpileModule(fs.readFileSync(path.join(root, 'src/plugins/player/index.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
  const calls = []
  const indexModule = { exports: {} }
  const dependencies = {
    'react-native-track-player': { default: trackPlayer },
    './utils': {
      updateOptions: async() => {},
      setVolume: async() => {},
      setPlaybackRate: async() => {},
      migratePlayerCache: async() => {},
      clearPlayerCacheFiles: async() => { calls.push('clear-files') },
      clearCache: async() => { calls.push('clear') },
      getCacheSize: async() => cacheSize,
    },
    './cache': moduleRecord.exports,
  }
  new Function('module', 'exports', 'require', indexSource)(indexModule, indexModule.exports, id => dependencies[id]) // eslint-disable-line no-new-func
  return { initial: indexModule.exports.initial, calls }
}

test('player cache policy keeps the default and hard limit at 256 MiB', () => {
  assert.equal(DEFAULT_PLAYER_CACHE_SIZE_MIB, 256)
  assert.equal(MAX_PLAYER_CACHE_SIZE_MIB, 256)
  assert.equal(normalizePlayerCacheSize(1024), 256)
})

test('player cache policy preserves disabled and valid values', () => {
  assert.equal(normalizePlayerCacheSize(0), 0)
  assert.equal(normalizePlayerCacheSize(-1), 0)
  assert.equal(normalizePlayerCacheSize(Number.NaN), 0)
  assert.equal(normalizePlayerCacheSize(128.9), 128)
})

test('player initialization clamps legacy limits and clears an over-limit cache once', async() => {
  const setupCalls = []
  const trackPlayer = { setupPlayer: async options => { setupCalls.push(options) } }
  const player = loadPlayerIndex(trackPlayer, 300 * 1024 * 1024)
  global.lx = { playerStatus: { isIniting: false, isInitialized: false } }
  await player.initial({ volume: 1, playRate: 1, cacheSize: 1024, isHandleAudioFocus: true, isEnableAudioOffload: true })
  assert.equal(setupCalls[0].maxCacheSize, 256 * 1024)
  assert.deepEqual(player.calls, ['clear'])
})

test('disabling player cache removes the old on-disk cache before setup', async() => {
  const setupCalls = []
  const trackPlayer = { setupPlayer: async options => { setupCalls.push(options) } }
  const player = loadPlayerIndex(trackPlayer, 0)
  global.lx = { playerStatus: { isIniting: false, isInitialized: false } }
  await player.initial({ volume: 1, playRate: 1, cacheSize: 0, isHandleAudioFocus: true, isEnableAudioOffload: true })
  assert.equal(setupCalls[0].maxCacheSize, 0)
  assert.deepEqual(player.calls, ['clear-files'])
})
