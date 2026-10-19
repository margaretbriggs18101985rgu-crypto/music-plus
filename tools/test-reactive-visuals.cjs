const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { test } = require('node:test')
const moduleResult = { exports: {} }
// eslint-disable-next-line no-new-func
new Function('exports', ts.transpileModule(fs.readFileSync('src/utils/reactiveVisuals.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(moduleResult.exports)
const { parseReactiveVisuals, reactiveVisualDefaults: defaults } = moduleResult.exports

test('old, missing and malformed visual preferences receive complete usable defaults', () => {
  assert.equal(defaults.spectrumEnabled, false)
  for (const input of ['{}', '', 'null', '[]', '{bad', undefined, 42]) assert.deepEqual(parseReactiveVisuals(input), defaults)
})

test('backup roundtrip preserves independent controls and numeric limits reject unsafe inputs', () => {
  const selected = {
    ...defaults,
    cinemaEnabled: false,
    starRiver: false,
    particleGlow: true,
    terrainEnabled: true,
    intensity: 1.4,
    kickAuto: false,
    kickLowHz: 50,
    kickHighHz: 140,
    midWeight: 0,
    spectrumEnabled: false,
  }
  assert.deepEqual(parseReactiveVisuals(JSON.stringify(selected)), selected)
  const invalid = parseReactiveVisuals({ intensity: Infinity, depth: -2, particleSize: 99, cinemaEnabled: 'false', kickLowHz: 200, kickHighHz: 30 })
  assert.equal(invalid.intensity, defaults.intensity)
  assert.equal(invalid.depth, 0)
  assert.equal(invalid.particleSize, 3)
  assert.equal(invalid.cinemaEnabled, true)
  assert.ok(invalid.kickLowHz < invalid.kickHighHz)
})
