const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')
const { createHash } = require('node:crypto')
const { verifyBundleMetadata } = require('./android-bundle-metadata.cjs')

function load(file, dependencies) {
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(module, module.exports, key => {
    assert.ok(Object.hasOwn(dependencies, key), `Unexpected dependency: ${key}`)
    return dependencies[key]
  })
  return module.exports
}

const info = native => load('src/config/appInfo.ts', { 'react-native': { NativeModules: native }, '../../package.json': { version: '1.1.6' } })

test('installed Android version wins over the old version literal in a cached bundle', () => {
  const app = info({ UtilsModule: { appVersion: '1.1.8' } })
  assert.equal(app.appVersion, '1.1.8')
  const state = load('src/store/version/state.ts', { '@/config/appInfo': app }).default
  assert.equal(state.versionInfo.version, '1.1.8')
})

test('development clients without a native version constant retain the bundled fallback', () => {
  for (const native of [{}, { UtilsModule: {} }, { UtilsModule: { appVersion: null } }, { UtilsModule: { appVersion: ' ' } }]) {
    assert.equal(info(native).appVersion, '1.1.6')
  }
})

test('release gate rejects a cached JS version, wrong native code, or unrelated bundle metadata', () => {
  const bundle = Buffer.concat([Buffer.from('c61fbc03c103191f', 'hex'), Buffer.from('test bytecode')])
  const pkg = { version: '1.1.8', versionCode: 10 }
  const metadata = { ...pkg, bundleSha256: createHash('sha256').update(bundle).digest('hex') }
  assert.doesNotThrow(() => verifyBundleMetadata(metadata, bundle, pkg))
  assert.throws(() => verifyBundleMetadata({ ...metadata, version: '1.1.6' }, bundle, pkg), /JS bundle version differs/)
  assert.throws(() => verifyBundleMetadata({ ...metadata, versionCode: 9 }, bundle, pkg), /versionCode differs/)
  assert.throws(() => verifyBundleMetadata({ ...metadata, bundleSha256: '0'.repeat(64) }, bundle, pkg), /do not match/)
  assert.throws(() => verifyBundleMetadata(metadata, Buffer.from('plain JS'), pkg), /not Hermes/)
  assert.throws(() => verifyBundleMetadata(null, bundle, pkg), /metadata is missing/)
})
