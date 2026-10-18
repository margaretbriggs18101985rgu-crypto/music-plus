const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const ts = require('typescript')

function fixture() {
  const listeners = new Set()
  class NativeEventEmitter {
    addListener(name, listener) {
      listeners.add(listener)
      return { remove: () => listeners.delete(listener) }
    }
  }
  const source = fs.readFileSync(path.join(__dirname, '../src/utils/nativeModules/userApi.ts'), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const module = { exports: {} }
  new Function('module', 'exports', 'require', output)(module, module.exports, id => {
    assert.equal(id, 'react-native')
    return { NativeEventEmitter, NativeModules: { UserApiModule: { loadScript() {} } } }
  })
  return { api: module.exports, emit: event => listeners.forEach(listener => listener(event)) }
}

test('two subscribers can decode the same native JSON event without mutating it', () => {
  const f = fixture()
  const received = []
  const remove = f.api.onScriptAction(event => received.push(event))
  f.api.onScriptAction(event => received.push(event))
  const native = { action: 'response', data: JSON.stringify({ status: true, requestKey: 'test', result: 'ok' }) }
  f.emit(native)
  assert.equal(received.length, 2)
  assert.equal(received[0].data.result, 'ok')
  assert.deepEqual(received[0], received[1])
  assert.equal(typeof native.data, 'string')
  remove()
  f.emit(native)
  assert.equal(received.length, 3)
})

test('already decoded initialization data stays intact when script info is merged', () => {
  const f = fixture()
  f.api.loadScript({ id: 'test', name: 'Fixture', script: '' })
  let received
  f.api.onScriptAction(event => { received = event })
  const native = { action: 'init', data: { status: true, info: { version: '2' } } }
  f.emit(native)
  assert.equal(received.data.info.name, 'Fixture')
  assert.equal(received.data.info.version, '2')
  assert.deepEqual(native.data.info, { version: '2' })
})
