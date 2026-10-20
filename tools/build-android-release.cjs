const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const os = require('node:os')
const assert = require('node:assert/strict')
const { verifyBundleMetadata } = require('./android-bundle-metadata.cjs')

const root = path.resolve(__dirname, '..')
const javaHome = process.env.JAVA_HOME
if (!javaHome || !fs.existsSync(path.join(javaHome, 'release')) || !/JAVA_VERSION="17\./.test(fs.readFileSync(path.join(javaHome, 'release'), 'utf8'))) {
  throw new Error('Set JAVA_HOME to JDK 17. See doc/RELEASING.md.')
}
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android/Sdk'))
if (!sdk || !fs.existsSync(path.join(sdk, 'platforms/android-36/android.jar'))) {
  throw new Error('Set ANDROID_HOME to an Android SDK containing API 36.')
}
if (!fs.existsSync(path.join(root, 'android/keystore.properties')) && !process.env.ORG_GRADLE_PROJECT_MYAPP_UPLOAD_STORE_FILE) {
  throw new Error('Release signing is required. See doc/RELEASING.md; never commit your signing key.')
}
const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk }
const args = [':app:assembleRelease', ':app:testReleaseUnitTest', '-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64', '--console=plain', '--stacktrace', '--max-workers=2']
const result = process.platform == 'win32'
  ? spawnSync('cmd.exe', ['/d', '/c', 'gradlew.bat', ...args], { cwd: path.join(root, 'android'), env, stdio: 'inherit' })
  : spawnSync('./gradlew', args, { cwd: path.join(root, 'android'), env, stdio: 'inherit' })
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status || 1)

const pkg = require('../package.json')
const bundleDir = path.join(root, 'android/app/build/generated/assets/createBundleReleaseJsAndAssets')
verifyBundleMetadata(JSON.parse(fs.readFileSync(path.join(bundleDir, 'musicplus-build.json'), 'utf8')),
  fs.readFileSync(path.join(bundleDir, 'index.android.bundle')), pkg)

const verifyApk = (apk, abi) => {
  const badging = spawnSync(path.join(sdk, 'build-tools/35.0.0/aapt' + (process.platform === 'win32' ? '.exe' : '')),
    ['dump', 'badging', apk], { encoding: 'utf8' })
  if (badging.error) throw badging.error
  assert.equal(badging.status, 0, 'Cannot inspect APK package version')
  const code = abi === 'universal' ? pkg.versionCode : pkg.versionCode * 1000 + { 'armeabi-v7a': 1, x86: 2, 'arm64-v8a': 3, x86_64: 4 }[abi]
  assert.ok(badging.stdout.includes("name='io.github.musicplus.player'"), 'Unexpected APK package')
  assert.ok(badging.stdout.includes(`versionName='${pkg.version}'`) && badging.stdout.includes(`versionCode='${code}'`), 'Native APK version differs from package.json')
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'musicplus-apk-version-'))
  const metadataPath = path.join(temp, 'assets/musicplus-build.json')
  const bundlePath = path.join(temp, 'assets/index.android.bundle')
  try {
    const extract = spawnSync(path.join(javaHome, 'bin/jar' + (process.platform === 'win32' ? '.exe' : '')),
      ['xf', apk, 'assets/musicplus-build.json', 'assets/index.android.bundle'], { cwd: temp, encoding: 'utf8' })
    if (extract.error) throw extract.error
    assert.equal(extract.status, 0, 'Cannot inspect APK bundle metadata')
    verifyBundleMetadata(JSON.parse(fs.readFileSync(metadataPath, 'utf8')), fs.readFileSync(bundlePath), pkg)
  } finally {
    for (const file of [metadataPath, bundlePath]) if (fs.existsSync(file)) fs.unlinkSync(file)
    if (fs.existsSync(path.join(temp, 'assets'))) fs.rmdirSync(path.join(temp, 'assets'))
    fs.rmdirSync(temp)
  }
}

const outputDir = path.join(root, 'build/apk')
fs.mkdirSync(outputDir, { recursive: true })
const hashes = []
for (const abi of ['universal', 'arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86']) {
  const filename = `${pkg.name}-v${pkg.version}-${abi}.apk`
  const source = path.join(root, 'android/app/build/outputs/apk/release', filename)
  const output = path.join(outputDir, filename)
  verifyApk(source, abi)
  fs.copyFileSync(source, output)
  const hash = createHash('sha256').update(fs.readFileSync(output)).digest('hex')
  hashes.push(`${hash}  ${filename}`)
  console.log(`APK: ${output}`)
}
fs.writeFileSync(path.join(outputDir, 'SHA256SUMS.txt'), `${hashes.join('\n')}\n`)
