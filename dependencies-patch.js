// Compatibility fixes for the Gradle plugin pinned by React Native 0.73.11.
// Keep warnings-as-errors enabled; migrate the affected source APIs instead.
const fs = require('node:fs')
const path = require('node:path')

const pluginRoot = path.join(__dirname, 'node_modules/@react-native/gradle-plugin')
const plugin = require(path.join(pluginRoot, 'package.json'))
if (plugin.version != '0.73.5') throw new Error(`Review Gradle compatibility patches for plugin ${plugin.version}`)

const patches = [
  ['src/main/kotlin/com/facebook/react/ReactPlugin.kt', [
    ['Jvm.current()?.javaVersion?.majorVersion', 'Jvm.current().javaVersion?.majorVersion'],
  ]],
  ['src/main/kotlin/com/facebook/react/tasks/BundleHermesCTask.kt', [
    ['import java.io.File', 'import java.io.File\nimport javax.inject.Inject\nimport org.gradle.process.ExecOperations'],
    ['abstract class BundleHermesCTask : DefaultTask() {', 'abstract class BundleHermesCTask : DefaultTask() {\n\n  @get:Inject abstract val execOperations: ExecOperations'],
    ['    project.exec {', '    execOperations.exec {'],
  ]],
]

for (const [file, replacements] of patches) {
  const target = path.join(pluginRoot, file)
  let source = fs.readFileSync(target, 'utf8').replaceAll('\r\n', '\n')
  for (const [before, after] of replacements) {
    if (source.includes(after)) continue
    if (!source.includes(before)) throw new Error(`Patch target changed: ${file}`)
    source = source.replace(before, after)
  }
  fs.writeFileSync(target, source)
  console.log(`Verified Gradle compatibility patch: ${file}`)
}

const navigationPackage = require(path.join(__dirname, 'node_modules/react-native-navigation/package.json'))
if (navigationPackage.version != '7.39.2') throw new Error(`Review Android build tools patch for react-native-navigation ${navigationPackage.version}`)
const navigationBuildFile = path.join(__dirname, 'node_modules/react-native-navigation/lib/android/app/build.gradle')
let navigationBuild = fs.readFileSync(navigationBuildFile, 'utf8').replaceAll('\r\n', '\n')
const oldBuildTools = 'buildToolsVersion = "34.0.0"'
const projectBuildTools = 'buildToolsVersion = safeExtGet("buildToolsVersion", "35.0.0")'
if (!navigationBuild.includes(projectBuildTools)) {
  if (!navigationBuild.includes(oldBuildTools)) throw new Error('react-native-navigation Android build tools setting changed; review compatibility patch')
  navigationBuild = navigationBuild.replace(oldBuildTools, projectBuildTools)
}
fs.writeFileSync(navigationBuildFile, navigationBuild)
console.log('Verified Android build tools compatibility patch: react-native-navigation')
