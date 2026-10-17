# 黑胶播放器：阶段 A 与核心动画

视觉依据：`Android_Vinyl_Player_Codex_Package/README_FOR_CODEX.md` 与 `reference_player.jpg`。

## 开发计划与技术选择

在现有 React Native 0.73.11 工程中迭代，不另建替代 App。Android 竖屏播放详情使用 Kotlin + Compose 原生组件，通过 `LXVinylPlayer` 接收现有播放状态和发出操作事件。首页、音源、搜索、歌单、同步、后台播放器与横屏界面保留。原竖屏封面/歌词页保留在“更多歌曲操作 → 歌词与更多播放设置”中。

1. 阶段 A：连续蓝灰渐变、真实系统栏、顶部标签、黑胶、封面、白色唱臂、歌曲资料、进度/控制键及底部导航；提供 Compose Preview 和 Debug 原生演示入口。
2. 阶段 B 核心：12 秒顺时针匀速旋转；暂停保留角度；续转、缓冲停止、背景恢复、唱臂绕固定轴旋转、300ms 封面过渡。
3. 阶段 C：现有 TrackPlayer 分支实际上已使用 Media3 1.8.0。优先复用其服务和命令；后续补充系统文件选择器导入及端到端真实本地音频验证，不并行启动第二套后台服务。
4. 阶段 D：适配和稳定性验证，分清原生视觉演示与真实音频播放。

工具链保留 AGP 8.10.1、Gradle 8.11.1、JDK 17、Kotlin 1.9.24、compileSdk 36、NDK 26.1.10909125。新增 Compose 1.7.8 与兼容 Kotlin 1.9.24 的 Compose Compiler 1.5.14；Coil 2.6.0 避免引入 Kotlin 2.0。

## 关键代码

原生目录：`android/app/src/main/java/cn/toside/music/mobile/vinyl/`。

| 文件 | 职责 |
| --- | --- |
| `PlayerScreen.kt` | 页面布局、渐变、安全区、常见与窄屏 Compose Preview |
| `VinylRecord.kt` | 一次生成并缓存的沟槽与反光纹理、圆形封面、旋转合成层 |
| `VinylRotationClock.kt` | 可独立测试的累计角度；暂停清除计时基点，不清除角度 |
| `Tonearm.kt` | 白色唱臂、轴承、唱头；绕实际支点摆动 600ms |
| `SongInfo.kt` | 长标题省略、歌手、真实收藏与歌曲信息菜单 |
| `PlaybackProgress.kt` | 真实时间、未知时长、拖动预览、松手发出 seek |
| `PlaybackControls.kt` | 上一首、播放暂停、下一首；空列表禁用 |
| `PlayerNavigation.kt` | 顶部唱片/歌词/歌单，底部返回/搜索/歌单/设置；全部连接现有功能 |
| `VinylPlayerView.kt` / `VinylPackage.kt` | React Native 原生组件桥接 |

播放器服务继续复用已锁定的 `react-native-track-player` 分支：`node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/MusicService.java`，实际 Media3 内核为同目录 `player/ExoPlayback.java`。业务命令保留于 `src/core/player/player.ts`，原进度/seek 管线位于 `src/core/init/player/playProgress.ts`。没有新增第二套音乐服务。

`src/screens/PlayDetail/Vertical/VinylPlayer.tsx` 监听 TrackPlayer 的真实播放状态：仅 `State.Playing` 时旋转，缓冲/连接/暂停/停止时不旋转；`ExoPlayback.getState()` 已用 Media3 `Player.isPlaying()` 判定真正播放。上一首/下一首、收藏、进度、设置都调用原有业务逻辑，未伪造音质或评论数。按用户后续要求移除福利、播客、笔记、评论等未实现入口，没有用“待实现”提示代替功能。

原生演示入口仅存在于 Debug：`android/app/src/debug/java/cn/toside/music/mobile/vinyl/VinylPreviewActivity.kt`，明确显示“界面演示 · 无音频”。其按钮只验证动画，不启动或冒充音频播放。原创城市封面仅存放于 `src/debug/res/drawable-nodpi/vinyl_demo_cover.png`，不会代替正式歌曲封面。

“返回”会关闭播放详情、回到此前所在的主界面栏目；不会把设置页误标为首页。歌曲资料缺少歌手时显示“未知歌手”。原生容器读取实际 WindowInsets 与自身窗口位置，避免旧 RN 缓存的状态栏高度在缩放/刘海屏上造成多余顶部空白；底部已由 RNN 避让时不重复加边距。

## 编译与运行

```powershell
cd D:\MUSIC++
$env:JAVA_HOME='C:\Users\zs281\AppData\Local\mise\installs\java\temurin-17.0.20+101'
$env:ANDROID_HOME='C:\Users\zs281\AppData\Local\Android\Sdk'
npm run typecheck
npm run lint
cd android
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest -PstandaloneDebug=true '-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64' --console=plain --stacktrace --max-workers=2
```

交付 APK：`D:\MUSIC++\build\apk\lx-music-mobile-v1.9.1-debug-universal.apk`，76,794,071 字节，SHA-256：`312ce6424b6c7815b7aa8f0ebd847950413530de6484728478e3a5f784936ec3`。附同名 `.sha256` 文件。包含 `armeabi-v7a/arm64-v8a/x86/x86_64`，各 ABI 的 QuickBase64 原生库均已编译。Gradle 原始输出在 `android/app/build/outputs/apk/debug/`。

通用包必须编译四种 ABI：仅给 `reactNativeArchitectures` 指定两个 ABI 时，第三方预编译库仍可能使 universal APK 包含其余 ABI，造成那些 ABI 缺少现场编译的库。单架构开发请安装对应的分架构 APK。

日常重新打包可执行 `npm run pack:android:debug`。此脚本默认四 ABI，内置 Hermes/JS 资源，不需要 Metro；复制到 `build/apk/` 并生成校验文件。

```powershell
adb install -r D:\MUSIC++\build\apk\lx-music-mobile-v1.9.1-debug-universal.apk
adb shell am start -n cn.toside.music.mobile/.MainActivity
```

安装生成的 Debug APK 后，从首页底部播放条的封面或标题进入黑胶页；没有歌曲时显示空状态，不会假装播放成功。真实音频从原有歌曲来源进入播放列表。

原生视觉演示（无需 Metro 或选择歌曲）：

```powershell
adb shell am start -n cn.toside.music.mobile/.vinyl.VinylPreviewActivity
```

Android Studio 可打开 `PlayerScreen.kt` 的 `VinylPlayerPreview`，或 Debug 源集 `VinylDemoCoverPreview`。

## 动画复验步骤

1. 演示页点击中央播放按钮；唱片和封面整体顺时针转动，唱臂不跟随。
2. 两秒后暂停，观察至少两秒：封面方向保持；再次播放从该方向继续。
3. 播放时从更多菜单“刷新信息”，应继续匀速转动，没有回零；“模拟缓冲”应停转、保持落针；“停止并回针”应回位。
4. 返回后台再打开；前台恢复时从保留角度续转，不把后台的时间差加成一次大跳角。
5. 切换空状态、长标题、窄屏；歌曲资料不能遮住操作区，底部导航固定，短屏可滚动内容。

Debug 可复现命令：`adb shell am start -n cn.toside.music.mobile/.vinyl.VinylPreviewActivity --es vinyl_action snapshot`，在 `adb logcat -d -s VinylPreview:I` 查看真实角度。其他演示命令：`toggle`、`resume`、`refresh`、`buffer`、`stop`、`empty`。这些命令不会发出音频播放成功事件。

## 验证记录

2026-10-16，真实 Android SDK / JDK 17 构建和 API 37 x86_64 模拟器验收：

- `npm ls --depth=0`、`npm run typecheck`、`npm run lint` 通过；最后两项没有屏蔽源代码诊断。
- `:app:assembleDebug :app:testDebugUnitTest` 通过，四 ABI 包已实际安装、启动；3 项旋转时钟单元测试通过。最后增量构建 15 秒。
- Metro 生成 JS Bundle 后由 Hermes 编译并内置 APK；`assets/index.android.bundle` 为 2,470,980 字节。启动不依赖 Metro。
- APK v1/v2 签名验证、16KB ZIP 对齐检查通过；没有宣称所有第三方 `.so` 的 ELF 段均已通过 16KB 页设备验收。
- 标准视口 706×1536 px（392.2×853.3 dp，density 1.8）、窄屏 640×1280 px（320×640 dp，density 2.0）已截图检查。窄屏内容可滚动，底部导航固定；长标题省略，空状态/缺封面有统一占位。
- Debug 原生动画自动检查通过：暂停 72.499997° → 72.499997°；恢复继续增加约 17°；刷新歌曲资料继续增加约 12°。报告：`build/vinyl-validation/final/animation-results.json`。脚本：`tools/test-vinyl-animation.py`。
- 正式 RN → Compose 页已实际点按：菜单、返回、搜索、歌单、设置、歌词及返回黑胶、歌曲信息。没有新增福利、评论、笔记等无实现入口。
- 使用自行生成的 300 秒 PCM WAV，通过原有文件打开流程接入真实 Media3：原生播放/暂停、拖动到约 02:56、短时后台播放、系统媒体键播放/暂停通过。唱片区域播放时两张截图不同，暂停时像素差为 0。报告：`build/vinyl-validation/real-audio-results.json`。
- 两首测试音频的上一首/下一首 A↔B、正式收藏、进程重启后收藏保留通过。报告：`build/vinyl-validation/queue-results.json`。
- 构建日志：`build/vinyl-validation/android-build-delivery.log`；原生效果截图：`doc/ui/vinyl-player-android.png`；视觉对照与边界状态验收：根目录 `design-qa.md`。

模拟器以 `-no-audio` 运行，未验证可听声音/音质。短时后台与系统媒体键测试不能代表长时间休眠、厂商后台策略、蓝牙或实体耳机验收。测试音频只在本机忽略的构建目录及模拟器缓存中，未内置进 App。

## 后续范围

阶段 A 与阶段 B 核心已实现并运行验证。阶段 C 复用原有 Media3 后，已有文件打开、本地音频播放、seek、切歌、收藏、短时后台、系统媒体键已验证；新增的系统文件选择器导入尚未实现，原有目录导入保留。通知面板按钮、实体耳机/蓝牙、真机声音和长期后台仍待验收。在线音源可用性、同步服务器端到端回归没有本次测试数据，未宣称通过。演示页收藏仅为临时演示；正式页收藏使用洛雪现有“我的收藏”持久化与同步逻辑。

### 对照需求第 9 节的自检

| 验收项 | 结果 |
| --- | --- |
| 主色调、比例和布局 | 通过原生截图与参考图同视口对照；导航内容按用户要求精简 |
| 沟槽、圆形封面、整体旋转 | 通过；纹理缓存，不按帧重画沟槽 |
| 独立唱臂、固定轴承 | 通过截图与暂停/停止状态检查 |
| 实际播放/暂停驱动旋转 | 本地 WAV 实际播放/暂停通过；真实网络缓冲未制造测试，代码使用真实 isPlaying 门控 |
| 暂停保持、恢复续转 | 时钟单测、原生演示自动测试、正式页截图检查通过 |
| 切歌信息/时长/进度与封面过渡 | A↔B 信息/时长/进度通过；封面 300ms 过渡已实现，两首不同真实封面切换仍待验收 |
| 播放、上下首、Seek 接 Media3 | 本地测试音频通过 |
| 外部状态更新不重置转角 | 资料刷新自动检查、真实播放进度更新时截图通过 |
| 空、缓冲、错误、缺封面 | 空/缺封面原生通过；缓冲演示通过；实际解码/网络错误路径仍待验收 |
| 常见屏与窄屏 | 通过；短屏需要滚动查看完整舞台与控制区 |
| 后台返回与同步 | 短时后台/系统键通过；长时休眠与厂商策略待真机验证 |
| 构建、操作说明、结果与未完成项 | 已记录于本文与 `design-qa.md` |

Debug 原生演示只显示可用的唱片/歌单标签；底部入口通过 `VinylNavigationModule.kt` 打开正式 App 对应页面。正式播放页还提供原有歌词页入口。生成的 Gradle 测试报告属于构建产物，已从 ESLint 输入范围排除，不修改项目源代码检查规则。

## 参考

### 演示封面素材

内置 ImageGen 生成，实际 1254 × 1254 PNG；路径为 `android/app/src/debug/res/drawable-nodpi/vinyl_demo_cover.png`。SHA-256：`62fd0b22043a973dd1c845872f9a838c5a6dc492628794b9f90e3d07bdefa62b`。提示词如下，仅生成专辑封面图像，不包含参考 UI：

```text
Use case: photorealistic-natural
Asset type: original square 1024x1024 photographic album-cover art used solely in an Android Debug UI demonstration.
Primary request: photograph a quiet, believable city street corner during early blue hour, with cool blue-gray architecture and a few restrained warm red and amber neon-like light accents. Real urban building textures, subtle film grain, cinematic but natural photographic light. No people are necessary.
Composition/framing: a strong city-corner subject and depth in the center, suitable for a circular crop; keep the interesting architecture and light within the central circle while filling the full square image with the scene. Eye-level street photography, no border.
Lighting/mood: reflective, calm early-morning or blue-hour atmosphere, cool environment with small warm highlights.
Constraints: create original imagery inspired only by a cold urban mood. No brands, logos, readable writing, typography, watermarks, records, tonearms, phones, interfaces, album title, or artist name. This is image art only, not a UI mockup.
```

### 官方资料

- [Compose Compiler 与 Kotlin 官方兼容表](https://developer.android.com/jetpack/androidx/releases/compose-kotlin)
- [Coil 发布记录](https://coil-kt.github.io/coil/changelog/)
- 上下首矢量来自 Google Material Icons 的 [skip_next](https://github.com/google/material-design-icons/blob/master/src/av/skip_next/materialicons/24px.svg) / [skip_previous](https://github.com/google/material-design-icons/blob/master/src/av/skip_previous/materialicons/24px.svg)，遵循其 Apache-2.0 许可；其余字体图标复用工程 IcoMoon 资源。
