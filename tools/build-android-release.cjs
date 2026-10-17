const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')

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
const outputDir = path.join(root, 'build/apk')
fs.mkdirSync(outputDir, { recursive: true })
const hashes = []
for (const abi of ['universal', 'arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86']) {
  const filename = `${pkg.name}-v${pkg.version}-${abi}.apk`
  const source = path.join(root, 'android/app/build/outputs/apk/release', filename)
  const output = path.join(outputDir, filename)
  fs.copyFileSync(source, output)
  const hash = createHash('sha256').update(fs.readFileSync(output)).digest('hex')
  hashes.push(`${hash}  ${filename}`)
  console.log(`APK: ${output}`)
}
fs.writeFileSync(path.join(outputDir, 'SHA256SUMS.txt'), `${hashes.join('\n')}\n`)
