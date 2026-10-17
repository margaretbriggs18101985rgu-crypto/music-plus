const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')

const root = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const architectureIndex = args.indexOf('--architectures')
const architectures = architectureIndex < 0 ? 'armeabi-v7a,arm64-v8a,x86,x86_64' : args[architectureIndex + 1]
if (!architectures || architectures.split(',').some(abi => !['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'].includes(abi))) {
  throw new Error('Use --architectures with a comma-separated list of supported Android ABIs.')
}
const javaHome = process.env.JAVA_HOME
if (!javaHome || !fs.existsSync(path.join(javaHome, 'release')) || !/JAVA_VERSION="17\./.test(fs.readFileSync(path.join(javaHome, 'release'), 'utf8'))) {
  throw new Error('Set JAVA_HOME to an independent JDK 17 installation before building.')
}
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android/Sdk'))
if (!sdk || !fs.existsSync(path.join(sdk, 'platforms/android-36/android.jar'))) {
  throw new Error('Set ANDROID_HOME to an Android SDK containing API 36.')
}
const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk }
console.log(`JAVA_HOME=${javaHome}\nANDROID_HOME=${sdk}\nNode: ${process.version}`)
const gradleArgs = [':app:assembleDebug', `-PreactNativeArchitectures=${architectures}`, '--console=plain', '--stacktrace', '--max-workers=2']
if (!args.includes('--metro')) gradleArgs.push('-PstandaloneDebug=true')
const result = process.platform == 'win32'
  ? spawnSync('cmd.exe', ['/d', '/c', 'gradlew.bat', ...gradleArgs], { cwd: path.join(root, 'android'), env, stdio: 'inherit' })
  : spawnSync('./gradlew', gradleArgs, { cwd: path.join(root, 'android'), env, stdio: 'inherit' })
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status || 1)

const pkg = require('../package.json')
const source = path.join(root, 'android/app/build/outputs/apk/debug', `${pkg.name}-v${pkg.version}-universal.apk`)
const outputDir = path.join(root, 'build/apk')
fs.mkdirSync(outputDir, { recursive: true })
const filename = `${pkg.name}-v${pkg.version}-debug-universal.apk`
const output = path.join(outputDir, filename)
fs.copyFileSync(source, output)
const hash = createHash('sha256').update(fs.readFileSync(output)).digest('hex')
fs.writeFileSync(`${output}.sha256`, `${hash}  ${filename}\n`)
console.log(`APK: ${output}\nSHA256: ${hash}`)
