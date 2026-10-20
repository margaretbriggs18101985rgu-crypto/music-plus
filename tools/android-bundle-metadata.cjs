const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')

const verifyBundleMetadata = (metadata, bundle, pkg) => {
  assert.ok(metadata && typeof metadata === 'object', 'JS bundle build metadata is missing')
  assert.equal(metadata.version, pkg.version, 'JS bundle version differs from package.json; rebuild the bundle')
  assert.equal(metadata.versionCode, pkg.versionCode, 'JS bundle versionCode differs from package.json')
  assert.equal(bundle.subarray(0, 8).toString('hex'), 'c61fbc03c103191f', 'Release bundle is not Hermes bytecode')
  assert.equal(metadata.bundleSha256, createHash('sha256').update(bundle).digest('hex'), 'JS bundle and build metadata do not match')
}

module.exports = { verifyBundleMetadata }
