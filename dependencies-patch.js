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

// Keep playback changes reproducible after npm install, rather than editing node_modules only.
const playerRoot = path.join(__dirname, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer')
const playerPatches = [
  ['service/MusicService.java', [
    ['    Handler handler;', '    Handler handler;\n    private static MusicService activeService;\n\n    /** Stop audio before the Activity tears down React Native or other resources. */\n    public static void stopForAppExit() {\n        if (activeService != null) activeService.stopPlaybackForAppExit();\n    }\n\n    private void stopPlaybackForAppExit() {\n        android.util.Log.d("MusicPlusExit", "Stopping playback at " + android.os.SystemClock.elapsedRealtime());\n        if (manager != null && manager.getPlayback() != null) {\n            manager.getPlayback().setPlayerVolume(0);\n            manager.getPlayback().pause();\n            manager.getPlayback().stop();\n        }\n        destroy();\n        stopForeground(true);\n        stopSelf();\n    }'],
    ['        manager = new MusicManager(this);\n        handler = new Handler();',
      '        if (manager == null) manager = new MusicManager(this);\n        if (handler == null) handler = new Handler();'],
    ['        super.onCreate();\n        String channel', '        super.onCreate();\n        activeService = this;\n        String channel'],
    ['    public void onDestroy() {\n        super.onDestroy();\n\n        destroy();\n        stopForeground(true);\n    }',
      '    public void onDestroy() {\n        if (activeService == this) activeService = null;\n        stopPlaybackForAppExit();\n        super.onDestroy();\n    }'],
    ['    public void onTaskRemoved(Intent rootIntent) {\n        super.onTaskRemoved(rootIntent);\n\n        if (manager == null || manager.shouldStopWithApp()) {\n            if (manager != null && manager.getPlayback() != null) {\n                manager.getPlayback().stop();\n            }\n            destroy();\n            stopSelf();\n        }\n    }',
      '    public void onTaskRemoved(Intent rootIntent) {\n        if (manager == null || manager.shouldStopWithApp()) stopPlaybackForAppExit();\n        super.onTaskRemoved(rootIntent);\n    }'],
  ]],
  ['service/MusicManager.java', [
    ['private boolean stopWithApp = false;', 'private boolean stopWithApp = true;'],
    ['new DefaultRenderersFactory(service)', 'new com.guichaguri.trackplayer.service.player.ReactiveAudio(service)'],
    ['return new LocalPlayback(service, this, player, cacheMaxSize, autoUpdateMetadata);',
      'com.guichaguri.trackplayer.service.player.ReactiveAudio.attach(player);\n        return new LocalPlayback(service, this, player, cacheMaxSize, autoUpdateMetadata);'],
  ]],
  ['service/MusicBinder.java', [
    ['bundle.getBoolean("stopWithApp", false)', 'bundle.getBoolean("stopWithApp", true)'],
  ]],
  ['service/player/LocalPlayback.java', [
    ['    public void destroy() {\n        super.destroy();', '    public void destroy() {\n        ReactiveAudio.detach(player);\n        super.destroy();'],
  ]],
  ['service/models/Track.java', [
    ['.setConstantBitrateSeekingEnabled(true)', '.setConstantBitrateSeekingEnabled(true)\n                        .setMp3ExtractorFlags(androidx.media3.extractor.mp3.Mp3Extractor.FLAG_ENABLE_INDEX_SEEKING)'],
  ]],
]
for (const [file, replacements] of playerPatches) {
  const target = path.join(playerRoot, file)
  let source = fs.readFileSync(target, 'utf8').replaceAll('\r\n', '\n')
  for (const [before, after] of replacements) {
    if (source.includes(after)) continue
    if (!source.includes(before)) throw new Error(`Playback patch target changed: ${file}`)
    source = source.replace(before, after)
  }
  fs.writeFileSync(target, source)
}
for (const name of ['ReactiveAudio.java', 'AudioBands.java']) {
  fs.copyFileSync(path.join(__dirname, 'android/player-patches', name), path.join(playerRoot, 'service/player', name))
}
console.log('Verified audio analysis, app-exit shutdown and MP3 seek patches: react-native-track-player')
