# 沉浸式空间歌词：实施计划与 P0 基线

日期：2026-10-17（Asia/Hong_Kong）。本轮执行实施文档定义的第一阶段 P0；P1/P2/P3 尚未实施，以下参数为计划，不代表已验收功能。

## 需求与工作区保护

- 唯一新增需求来源：根目录 `MUSIC++ — 沉浸式空间歌词播放器开发实施文档/MUSIC++_沉浸式歌词播放器_Codex开发文档.md`（v1.0）。已查看同目录 `user_reference_scene.jpg`；仅参考大字发光歌词、暗色氛围、悬浮层次和简洁底栏。
- 起始分支：`codex/open-source-release`；HEAD：`814ae0d845b39e0a92876087150e8d522d2b4301`，与文档审阅基线一致。
- 独立工作分支：`codex/immersive-lyrics`，从上述本地 HEAD 创建，未拉取/重置远端。
- 起始已跟踪文件无修改。唯一未跟踪项是用户提供的需求目录，保持原样，不删除、不加入本阶段提交。未执行 stash、clean、reset、依赖重装或 lockfile 更新。
- 仓库及 `D:/` 未发现适用的 `AGENTS.md`。
- 仅 Android 竖屏播放详情；音源、音频服务、横屏、发布流程不在新增需求范围。

## 用户补充的参考项目

2026-10-17 用户允许参考 [MorsBrenn/mineradio-mobile](https://github.com/MorsBrenn/mineradio-mobile)。已阅读 README 和固定提交 `71a8fe327bff745d7d46dae275570d9e6e2f31d6` 的 `public/index.html`，作为实现思路参考；需求仍以实施文档为准。

| 参考位置（固定提交的 public/index.html） | 可借鉴思路与本项目落点 |
| --- | --- |
| [L1808 舞台歌词样式](https://github.com/MorsBrenn/mineradio-mobile/blob/71a8fe327bff745d7d46dae275570d9e6e2f31d6/public/index.html#L1808) | 大字、柔光及空间入场层次 → `PlayerLyrics.kt` / `LyricMotion.kt`。本项目使用完整换行、轻量切句弹跳，按需求文档调节幅度和时长。 |
| [L9539 封面调色](https://github.com/MorsBrenn/mineradio-mobile/blob/71a8fe327bff745d7d46dae275570d9e6e2f31d6/public/index.html#L9539) | 降采样取代表色、亮度/色彩约束与回退的思路 → `AmbientBackground.kt`。实际读取来自本地 Coil 位图，深色背景和浅色歌词对比优先。 |
| [L3383 移动端降档](https://github.com/MorsBrenn/mineradio-mobile/blob/71a8fe327bff745d7d46dae275570d9e6e2f31d6/public/index.html#L3383) | 粒子密度/渲染预算随设备约束降低 → `ImmersiveVisualConfig.kt` / `AmbientParticles.kt`，需实测档位，而非仅按屏幕宽度推断性能。 |
| [L6731 指针拖动](https://github.com/MorsBrenn/mineradio-mobile/blob/71a8fe327bff745d7d46dae275570d9e6e2f31d6/public/index.html#L6731) | 输入位置直接驱动空间变化、拖动阈值区分点击的思路 → `ImmersiveLyricStage.kt`。本项目另行实现 Compose 横向锁定与释放回弹，并验证与纵向列表的冲突处理。 |

参考项目是 Web/Capacitor + Three.js 技术路线。本项目继续使用原生 Compose；当前只做源码阅读及概念参考，没有复制其代码、标识、图片、播放器或依赖，也未运行参考项目脚本。参考源码副本仅存于忽略的本地证据目录。

## 实际源码审计

| 文件 | 当前行为与实施约束 |
| --- | --- |
| `android/app/src/main/java/cn/toside/music/mobile/vinyl/PlayerScreen.kt` | `Column` 中以 `lyricsVisible` 分支切换黑胶/歌词。进度、控制和信息/下载位于分支外；保留固定布局。背景目前是静态 `VinylPalette` 渐变。 |
| `.../PlayerLyrics.kt` | 单个 `LazyColumn`、边缘遮罩、21sp 正文/14sp 译文；点击发送 `seek(time / 1000.0)`。跟随 effect 依赖 trackId/activeLyric，滚动当下跳过；下一句可能立刻恢复跟随，需要改进手动浏览策略。尚无横向手势、透视、弹跳。 |
| `.../VinylPlayerState.kt` | 已有完整真实播放/歌词/封面字段及默认值；继续以 `lyricsVisible` 为模式唯一来源，无需新增并行模式状态。 |
| `.../VinylPlayerView.kt` | RN props 重建 state，事件使用既有 `topPlayerAction`；每次读取歌词数组。安全区基于窗口实际坐标校正，不能叠加第二套 padding。对缺失 time/translation 和非法数值的防护尚不完整，P1 加固时保留行索引对应关系。 |
| `src/screens/PlayDetail/Vertical/VinylPlayer.tsx` | `State.Playing && hasTrack` 决定播放态，缓冲/连接只显示状态。歌词来自 `useLrcSet()`/`useLrcPlay()`，映射 `{time,text,translation}`。Seek 经 `setProgress` 进入原业务并按 duration clamp；目前没有非有限值校验。动画不得逐帧经 JS 桥发送。 |
| `.../VinylRecord.kt` | Coil 带既有 User-Agent，封面交叉淡入，纹理 remember 缓存；仅播放且 Lifecycle RESUMED 执行帧循环。复用图像缓存与生命周期模式。 |
| `.../VinylRotationClock.kt`、`Tonearm.kt` | 30°/秒累计旋转，pause 清帧基准但不清累计角度；唱臂独立动画。`VinylVisualMemory.clock` 跨视图保留角度。保留实现，歌词动效不写该时钟。 |
| `.../PlaybackProgress.kt` | 真实进度、拖动预览、松手 Seek、取消清理与无障碍 setProgress；舞台手势限定在歌词区域。 |
| `.../PlaybackControls.kt`、`PlayerNavigation.kt`、`SongInfo.kt` | 既有 mode/previous/toggle/next/queue/back/lyrics/artist/favorite/comment/info/download 操作及禁用语义均保留，不新增占位操作。 |
| `src/plugins/lyric.ts`、`src/core/lyric.ts`、`src/core/init/player/lyric.ts` | 原行级 LRC 解析器及扩展译文；播放由原播放器 position 转毫秒同步，musicToggled 清理歌词。没有可直接使用的精确逐字时间或 PCM/FFT，不能声称逐字同步/实时频谱。 |
| `src/config/defaultSetting.ts`、`src/types/app_setting.d.ts`、`src/config/setting.ts`、`src/core/common.ts` | 已有类型化扁平设置、默认值合并、节流持久化。没有沉浸式动效设置；P1 先内部配置，P3 再接入真实设置入口。保留现有翻译/罗马音选择。 |
| `android/app/src/test/java/cn/toside/music/mobile/vinyl/VinylRotationClockTest.kt` | 3 项累计旋转测试，必须持续通过。 |
| `android/app/src/debug/.../VinylPreviewActivity.kt` | 明确标注无音频的动画工具，不作为真实歌词/播放证据。正式运行证据从 MainActivity 的 RN→Compose 页面收集。 |
| `tools/test-vinyl-animation.py` | 脚本仍使用旧应用 ID `cn.toside.music.mobile`，当前 Gradle applicationId 已为 `io.github.musicplus.player`；不能直接把历史脚本结果当成本次结果。P0 不修改工具；如复用测试工具，需在后续修正目标并重新运行。 |

## 文件级开发计划

所有原生新增文件放在 `android/app/src/main/java/cn/toside/music/mobile/vinyl/`，单测放在对应 `android/app/src/test/java/` 包下。

### P0：本阶段

- 新增本文，保存源码审计、后续文件清单和验证边界。
- 在忽略目录 `build/immersive-validation/p0/` 保存本次日志、设备信息、截图/录屏与校验值；不会使用旧 QA 文件冒充本次运行。
- 执行 typecheck、lint、npm test、原生单测和四 ABI standalone Debug 构建。
- 连接可用真机或启动现有模拟器，同设备收集原黑胶页和原歌词页；记录 SDK、密度、分辨率、fontScale。环境失败须单独报告并保留日志。
- P0 不修改播放器实现，不宣称新视觉完成，也不发布 APK。

### P1：可用的空间歌词

| 文件 | 计划改动 |
| --- | --- |
| 新增 `ImmersiveLyricStage.kt` | 只包裹歌词舞台，按 touchSlop 锁方向，直接更新拖动，只有释放/cancel 才 spring；底部控件不在手势区域。 |
| 新增 `LyricPerspectiveController.kt` | 纯数学映射、有限值防护、横向边界、yaw/视差输出；零宽安全。 |
| 新增 `LyricMotion.kt` | 按 trackId/activeLyric 触发一次轻弹跳与柔光，遵守减少动画配置。 |
| 新增 `ImmersiveVisualConfig.kt` | 内部可测试配置及降级；不引入音频计时器、动画引擎或假设置按钮。 |
| 修改 `PlayerLyrics.kt` | 继续使用一份虚拟化列表；当前大字、弱化邻句、完整换行/译文；手动滚动后暂停跟随并提供自然恢复方式；真实 Seek 的有限值/范围防护。 |
| 修改 `PlayerScreen.kt` | 组合舞台与简易背景视差，保留原模式布尔值、底部控件、安全区及黑胶时钟。 |
| 必要时修改 `VinylPlayerView.kt`、`VinylPlayer.tsx` | 防护无效歌词/Seek；维持原 action 名称和毫秒→秒单位，不按播放秒数重建动画。 |
| 新增对应 JUnit 测试 | 零值/左右对称/clamp/零宽/非有限值，视差比例，cancel/reset，歌词 Seek 单位与坏数据；保留重复时间戳索引。 |

P1 初始参数：drag 限幅 ±0.28×舞台宽，归一化除以 0.25×宽；歌词位移 0.85×drag 且不超过 ±72dp；yaw ±9°，背景 0.15×drag；释放约 280–450ms 内稳定。当前字约 36sp，自适应 30–42sp，邻句 18–24sp、译文 14–18sp；弹入约 280–420ms。参数均待 Android 实测。

门槛：真实触摸跟手、透视与回弹；纵向浏览、行点击 Seek、进度拖动、黑胶返回及真实控制回归通过后进入 P2。纯函数单测不能代替触摸验证。

### P2：封面氛围与粒子

- 新增 `AmbientBackground.kt`：在封面/曲目改变时通过现有 Coil 管线后台取色，低亮度/饱和度约束，500–900ms 过渡、缺封面兜底、取消旧请求。
- 新增 `AmbientParticles.kt`：稳定种子创建参数，Canvas 约 20–45 个低亮粒子和 4–6 个柔光团；远/中/近视差 0.15/0.30/0.45，降档减少数量。
- 扩展内部配置与测试，按真实播放、缓冲、暂停、前后台控制帧循环，恢复不补播休眠时长；暗色遮罩优先保证歌词阅读。
- 门槛：亮/暗/高饱和/无封面、快速切歌无旧配色覆盖，暂停/后台行为及降级开关实测。

### P3：设置、切换与专项 QA

- `PlayerScreen.kt` 组合模式过渡；不将跨模式黑胶累计角度放入过渡的局部状态。
- `VinylPlayerState.kt`、`VinylPlayerView.kt`、`VinylPlayer.tsx` 仅增量传入有默认值的配置。
- `src/config/defaultSetting.ts`、`src/types/app_setting.d.ts`：新增配置类型/默认值，沿用现有合并与持久化，不改设置版本来制造无必要迁移。
- 新增 `src/screens/Home/Views/Setting/settings/Player/ImmersiveVisuals.tsx`，在同目录 `index.tsx` 注册，沿用 `CheckBoxItem`/现有选项组件；同步 `src/lang/zh-cn.json`、`zh-tw.json`、`en-us.json`。动效/粒子档位接 `updateSetting`，验证重启保留。
- 更新 `doc/VINYL_PLAYER.md`、`doc/CURRENT_UI.md`、`design-qa.md`，附真实改动后的证据和未覆盖项，不覆盖旧验收历史。
- 实测 320×640dp、常见屏、fontScale≥1.3、长句/双语/无歌词、TalkBack、系统动画关闭、生命周期、控制入口；采集帧时间/卡顿/内存及长期播放趋势。无测量不得宣布性能目标达成。
- 双指俯仰为可选增强；不以其阻塞基础交付。

## 本次 P0 验证结果

### 自动检查与构建

现有 `node_modules` 可用，因此未执行 npm ci。Node `24.22.0`、npm `11.19.1`、Temurin JDK `17.0.20.1`；使用仓库现有 AGP/Gradle/Kotlin/Compose/Coil 版本。

| 命令/验证 | 结果 | 本次证据（均位于 `build/immersive-validation/p0/`） |
| --- | --- | --- |
| `npm run typecheck` | PASS，exit 0 | `typecheck.log` |
| `npm run lint` | PASS，exit 0 | `lint.log` |
| `npm test` | PASS，40/40，无跳过 | `npm-test.log` |
| `android/gradlew.bat :app:testDebugUnitTest --console=plain --max-workers=2` | PASS，3/3 旋转测试，0 failures/errors，BUILD SUCCESSFUL（26s） | `android-unit.log`、`VinylRotationClockTest.xml` |
| `npm run pack:android:debug` | PASS，四 ABI standalone Debug，BUILD SUCCESSFUL（1m12s） | `android-debug.log` |
| `adb install -r` + 正式 MainActivity 启动 | PASS，Success / Status: ok | `install.log`、`launch.log` |
| `git diff --check` | PASS | P0 仅新增本文，播放器/依赖/构建配置无修改 |

APK：`build/apk/music-plus-v1.0.0-debug-universal.apk`，76,828,257 字节。SHA-256：`bfdf6eb96305adb4adcaa83c87036523a7be6783f216bed1285b836ca3b4cb9c`。Debug 安装验证，无 Release 构建、推送或发布。

没有阻塞构建的环境问题。已有 deprecated system bar API / Gradle 9 不兼容提示和第三方 Java 弃用提示仍存在，不将其归为本次新增故障。没有升级或修改工具链来消除提示。

### Android 运行证据

使用现有 AVD `MusicPlus_QA_20261017`，`emulator-5554`，Android 17 / SDK 37、x86_64、1080×2400、420dpi（约 411×914dp）、60Hz、fontScale 1.0。采用 SwiftShader，`-no-window -no-audio -no-snapshot-save`。启动前没有设备连接；启动该 AVD 后没有发现当前包，Debug 首次安装成功，没有卸载或清除应用数据。完成首次启动提示后，通过正式搜索→迷你播放器→Compose 详情进入，未使用 Debug 演示 Activity。

| 证据文件 | 内容与结论 |
| --- | --- |
| `device.json`、`display.txt` | 本次设备/密度/字体与显示信息。模拟器状态栏使用 UTC，本文日期与记录采用用户 Asia/Hong_Kong。 |
| `baseline-vinyl-with-lyrics.png` | 咪咕来源《Faded》/ Alan Walker、Iselin Solheim / Different World，正式黑胶页，真实播放进度与封面。 |
| `baseline-lyrics-populated.png`、`lyrics-populated-ui.xml` | 同曲歌词模式，真实 LRC 当前行高亮；截图时已暂停，进度约 00:31。 |
| `lyrics-manual-scroll.png` | 暂停时纵向浏览后可见更后面的歌词，进度约 00:21；滚动不改变音频曲目。 |
| `baseline-lyrics-controls.mp4` | 44.25s Android screenrecord，记录现有歌词行点击/纵向滑动、恢复播放、返回黑胶及暂停的操作过程。是改造前基线，不包含新增 3D/粒子。MP4 movie header 和时长已检查。 |
| `baseline-vinyl.png`、`baseline-lyrics-empty.png` | 网易云来源《Faded》/ 霓虹兔，原黑胶与无歌词状态；播放通过原服务，未伪造歌词。 |
| `baseline-controls.mp4` | 43.65s 首轮原页面操作记录，含空歌词、进度操作和返回搜索；不是新功能验收。 |
| `media-track3-paused.txt` | PAUSED，position=32483ms（同曲）。 |
| `media-lyric-seek-delayed.txt` | 点击较早歌词行后再恢复播放：PLAYING，position=21838ms，曲目/专辑保持一致；结合截图 00:21，确认行点击确实进入原播放器 Seek。当前未逐行比对原始 LRC 时间戳精度。 |
| `media-final-paused.txt` | 验证后保持 PAUSED，position=67096ms；未让测试歌曲继续循环。 |
| `media-after-progress-seek.txt` | 第一首曲进度点击后 PLAYING，position=19121ms；截图显示后续 00:21。 |
| `errors-final.log` | 本次检查范围未输出 AndroidRuntime / ReactNativeJS error；不代表全部业务路径无故障。 |

原始数据来自 TrackPlayer/MediaSession 和既有歌词桥，界面截图直接使用 adb screencap。未注入歌词、模拟进度或音频数据。MediaSession 的 position 是最后更新时的基准，播放中会按 speed/updated 推进，不能把相邻 dumpsys 基准相同误判为音频未走时。

### 基线中遇到的问题与未验证项

- 首首网易云测试曲歌词请求失败，正式页显示“暂无歌词 / Failed to get lyrics”；QQ 来源版本出现音频加载错误并触发原有跳歌，保留 `track2-result.png`、`track2-lyrics.png` 和媒体日志。这些发生于未改播放器源码的基线，未在 P0 扩展修复音源请求。之后咪咕来源版本实际加载了音频与完整歌词，补齐同曲黑胶/歌词证据。
- 播放动画/页面变化期间，部分 `uiautomator dump` 报 `could not get idle state`；失败时旧 XML 不是当时页面的有效证据，`vinyl-ui-idle-failed-stale.xml` 明确标记为废弃。最终在暂停后的歌词页成功取得 `lyrics-populated-ui.xml`，主要结论由截图、screenrecord、媒体状态交叉确认。
- `gfxinfo-uncontrolled.txt`、`meminfo-uncontrolled.txt` 只是混合测试过程的原始诊断快照，没有统一采样窗口、温度或功耗记录，不能据此宣布帧时间/掉帧率或性能目标通过。可比性能基线与 30 分钟测试仍未完成。
- NOT RUN：P1 横向跟手/透视/回弹及横纵冲突，P2 封面取色/粒子/生命周期，P3 持久化效果设置、窄屏、大字号、TalkBack、系统动画关闭与低性能档位。它们尚未开发，不能以 P0 通过代替验收。
- NOT RUN：本轮完整收藏持久化、评论/下载实际完成、队列重排、上一首/下一首、系统文件选择器、安全区不同配置和完整横屏回归。静态审计已确认这些入口的既有桥接，未宣称本次全量实测通过。
- NOT RUN：可听声音/音质、真机帧率/发热/耗电、蓝牙、通知按钮、长期后台与厂商省电策略。模拟器无音频输出且使用软件图形，不能替代真机。

P0 构建与基础运行门槛通过，可继续 P1。当前播放器实现与基线完全一致，本次实际新增仅为计划/审计文档和忽略目录中的运行证据。

### 复现

1. 在根目录使用上述 Node/JDK，执行四项 npm 检查与 `npm run pack:android:debug`；原生单测在 `android/` 执行表内 Gradle 命令。
2. `adb devices -l`，对实际设备执行 `adb -s <serial> install -r build/apk/music-plus-v1.0.0-debug-universal.apk`，若签名冲突保留数据并报告。
3. `adb -s <serial> shell am start -W -n io.github.musicplus.player/cn.toside.music.mobile.MainActivity`。
4. 原搜索输入 `Alan Walker Faded`，选择咪咕来源、专辑 Different World 的结果，等待真实加载；网络结果会变化，失败要记录。点击迷你栏进入黑胶，再点顶部曲名进入歌词。
5. 暂停后纵向滑动/点较早行，恢复后从界面和 `adb shell dumpsys media_session` 确认 Seek 与真实播放，点曲名返回黑胶。截图/录屏仅收集 Android 原页，运行后暂停播放。

## 回滚与阶段边界

基线源码保存在 `814ae0d845b39e0a92876087150e8d522d2b4301`。本阶段仅增加计划/审计文档，可单独撤销该文档提交。后续按 P1/P2/P3 小粒度提交，回滚使用对应提交的 revert，避免 hard reset 或清理用户文件。构建产物和测试设备不推送、不发布；测试安装保留应用数据，若签名冲突则报告而不卸载。
