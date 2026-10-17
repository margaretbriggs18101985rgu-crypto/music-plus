# Android 调试 APK 构建

本项目主目录使用 npm 与 `package-lock.json`。`tools/ui-preview` 是独立子项目，不参与 APK 打包。

## 工具链

| 工具 | 项目版本 |
| --- | --- |
| Node.js | 24.22.0，见 `.nvmrc` 和 `.mise.toml` |
| Java | Temurin JDK 17；不能使用 Android Studio 自带的较新 JBR 替代 |
| React Native / React | 0.73.11 / 18.2.0 |
| compileSdk / targetSdk / minSdk | 36 / 29 / 21 |
| Android Gradle Plugin | 8.10.1 |
| Gradle Wrapper | 8.11.1，固定官方 SHA-256 |
| Build Tools | 35.0.0 |
| NDK | 26.1.10909125 |
| CMake | 3.22.1 |

AGP 8.6 最高支持 API 35；这里保留 API 36，使用[明确支持 API 36 的 AGP 8.10 系列](https://developer.android.com/build/releases/agp-8-10-0-release-notes)，配套 Gradle 8.11.1、JDK 17 和 Build Tools 35.0.0。没有使用 `android.suppressUnsupportedCompileSdk`，没有升级 React Native、React 或 NDK。

## 环境与安装

当前 SDK 安装在 `C:\Users\zs281\AppData\Local\Android\Sdk`。设置 `JAVA_HOME` 指向独立 JDK 17，设置 `ANDROID_HOME` 指向 SDK。`android/local.properties` 记录本机 SDK 路径，该文件不提交到 Git。

项目 `.npmrc` 指定 `https://registry.npmmirror.com/`。安装已固定版本的主项目依赖：

```powershell
cd D:\MUSIC++
node --version
java -version
npm config get registry
npm ci --no-audit --no-fund
npm run typecheck
npm run lint
```

Git 依赖会执行自己的准备脚本，首次安装可能较慢；不要跳过这些脚本，否则播放器或文件系统包的 `lib` 文件可能缺失。

主项目 `postinstall` 还会运行 `dependencies-patch.js`。它只针对锁定的 `@react-native/gradle-plugin@0.73.5` 修正两项兼容点：删除 JVM 检测中多余的安全调用，并把 Hermes 打包任务的 `Project.exec` 迁移到注入的 `ExecOperations`。保留插件的 `allWarningsAsErrors=true`；补丁可重复执行，发现源码或版本不匹配时会明确失败。

## 生成独立调试 APK

```powershell
npm run pack:android:debug
```

此命令调用 `tools/build-android-debug.cjs`，检查 JDK 17 和 SDK API 36，然后执行：

```powershell
cd android
.\gradlew.bat :app:assembleDebug -PstandaloneDebug=true -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64 --console=plain --stacktrace --max-workers=2
```

`standaloneDebug=true` 会通过 React Native Gradle Plugin 内置 JS Bundle、资源与 Hermes 字节码，并关闭该调试变体对 Metro 的依赖。APK 仍由调试密钥签名，Android 的 `debuggable` 属性保留。普通 `npm run dev` 仍使用 Metro。

成功后脚本把通用 APK 复制到 `build/apk/`，并生成同名 `.sha256` 文件。Gradle 原始输出位于 `android/app/build/outputs/apk/debug/`。

仅构建 ARM64 时可使用：

```powershell
npm run pack:android:debug -- --architectures arm64-v8a
```

## 安装与运行

连接已授权的 Android 设备后：

```powershell
adb devices -l
adb install -r .\build\apk\music-plus-v1.0.0-debug-universal.apk
adb shell am start -n io.github.musicplus.player/cn.toside.music.mobile.MainActivity
```

如果设备上的同包名应用使用不同签名，覆盖安装会失败；请先保留原应用数据，不要直接卸载。

## 验证记录

2026-10-16 已完成真实 Android Debug 构建，APK：`build/apk/lx-music-mobile-v1.9.1-debug-universal.apk`（76,794,071 字节，四 ABI，JS/Hermes 内置）。`npm ls --depth=0`、完整 TypeScript 检查、ESLint、Android 编译和 3 项旋转时钟单元测试通过。APK v1/v2 签名与 ZIP 对齐检查通过，实际安装并运行于 API 37 x86_64 模拟器。

当前黑胶界面增加 Compose 1.7.8、Compose Compiler 1.5.14（Kotlin 1.9.24）及 Coil 2.6.0。已有依赖子项目的 AGP 仓库与版本、NDK/Build Tools 配置已统一到根工程，避免下载无关 NDK 27。原 NDK 26 保留。

通用包请使用默认四 ABI。只指定部分 ABI 时，其他第三方 AAR 仍可能把其余 ABI 的预编译库合入 universal 包，导致现场编译的库缺失；单架构开发请安装对应的分架构 APK。

正式页的导航、歌词、歌曲信息、真实本地测试 WAV 播放/暂停/Seek/上下首、收藏持久化及短时后台/系统媒体键已验证。详见 [黑胶播放器记录](VINYL_PLAYER.md) 和根目录 `design-qa.md`。浏览器预览不作为 Android 验收依据；真机可听声音、系统文件选择器、通知按钮及长期后台验证仍未完成。
