# 沉浸式空间歌词 P3：设置、切换与验收

日期：2026-10-18（Asia/Hong_Kong）。本阶段完成 P3 配置持久化与黑胶/歌词模式过渡；P0-P3 代码阶段均已实施。此记录只确认下列测试范围，不代表真机音质、长期性能或全部播放器业务已覆盖。

## 实现

- 播放设置新增“沉浸歌词特效”、歌词弹跳/拖动透视、动态背景、遵循系统减少动画，以及粒子数量 Auto/Low/High/Off。默认开启、Auto，复用已有 `updateSetting` 与设置存储；不变更设置 schema 版本。关闭主特效会停用背景/粒子/歌词运动配置，但歌词数据、纵向浏览、点击 Seek 与底部操作继续使用原播放器路径。
- 设置文案增加简体中文、繁体中文和英文。控制暴露可读标签、选中/禁用状态及激活无障碍动作；TalkBack 人工遍历未执行。
- RN `VinylPlayer.tsx` 将设置状态通过现有 Native Component props 增量传给 `VinylPlayerView.kt`，并以带默认值的 `VinylPlayerState` 继续走原 TrackPlayer/Media3 状态桥。没有增加音源、播放时钟、歌词或频谱数据通道。
- `PlayerScreen.kt` 在黑胶与歌词内容间使用 300ms Compose Crossfade；减少动画/视觉运动被禁用时切换时长为 0。播放进度、固定控制栏和播放器信息仍在过渡容器外；`VinylRotationClock` 沿用页面记忆实例，不被过渡局部状态替换。
- 新增设置合并/重载测试和原生设置映射测试。

## 文件

- `src/config/defaultSetting.ts`、`src/types/app_setting.d.ts`：新增五项类型化设置和默认值。
- `src/screens/Home/Views/Setting/settings/Player/ImmersiveVisuals.tsx`、`index.tsx`：新增原生设置控制并挂入播放器设置区。
- `src/lang/zh-cn.json`、`zh-tw.json`、`en-us.json`：设置标签、粒子档位与说明。
- `src/screens/PlayDetail/Vertical/VinylPlayer.tsx`：将持久化设置并入既有播放器状态 props。
- `android/app/src/main/java/cn/toside/music/mobile/vinyl/VinylPlayerState.kt`、`VinylPlayerView.kt`、`ImmersiveVisualConfig.kt`：有默认值的桥接和归一化映射。
- 新增 `android/app/src/main/java/cn/toside/music/mobile/vinyl/PlayerModeTransition.kt`；更新 `PlayerScreen.kt` 使用模式过渡并保留播放器时钟。
- `android/app/src/test/java/cn/toside/music/mobile/vinyl/ImmersiveVisualConfigTest.kt`、`tools/test-immersive-settings.cjs`：设置默认值、旧配置合并、持久化重载和原生映射测试。

## 自动验证

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS，42/42；包含 2 项 P3 设置测试 |
| `node --test tools/test-immersive-settings.cjs` | PASS，2/2 |
| `android/gradlew.bat :app:testDebugUnitTest --console=plain --max-workers=2` | PASS，31/31，0 failures/errors |
| `npm run pack:android:debug` | PASS，四 ABI standalone Debug APK |
| `git diff --check` | PASS；仅显示 Git 的 LF→CRLF 提示 |

APK：`build/apk/music-plus-v1.0.0-debug-universal.apk`，78,123,274 字节；SHA-256 `30be0e8d87325893883b8f85a04aad4712be4d6c73696a17c861f3b25b73c194`。构建日志为 `build/immersive-validation/p3/pack-debug.log`。

## Android 证据

设备为 AVD `MusicPlus_QA_20261017` / `emulator-5554`，Android 17 / API 37 / x86_64，1080×2400、420dpi、60Hz、fontScale 1.0，SwiftShader，`-no-audio`。通过正式 `MainActivity` 和真实 RN→Compose 页面验证；未使用 Debug 演示 Activity 注入歌词或播放状态。

| 证据 | 结果 |
| --- | --- |
| `build/immersive-validation/p3/settings-player-up.png` | 新设置位于现有“Playback”设置区；默认启用、Auto，原设置布局和迷你播放器/导航仍可见。 |
| `settings-effects-off.png`、`immersive-settings-off.log` | 从真实设置界面关闭主特效并设为 Low；子项正确显示禁用。原生日志记录 `animate=false particles=0 lyricMotion=false`。 |
| `effects-off-lyrics.png`、`media-effects-off-lyrics.txt` | 主特效关闭时，正式播放器仍显示原 LRC 行并使用 MediaSession/TrackPlayer 状态；没有注入歌词或进度。 |
| `settings-persist-check2.png` | 强制结束并重新启动应用后仍为关闭/Low，验证实际本地设置持久化。 |
| `settings-restored.png` | QA 后从设置界面恢复为默认启用/Auto。 |
| `play-track-vinyl.png` | 正式黑胶页仍工作，真实《Faded》/ Alan Walker 封面、进度与暂停按钮可见；与歌词模式共用原媒体状态。 |
| `mode-transition.mp4` | 正式播放器录屏，19.068 秒，4,286,373 字节；包含歌词/黑胶切换及快速反向切换。MP4 `moov`/`mvhd` 结构有效。配套截图为 `transition-lyrics.png`、`transition-vinyl.png`、`transition-rapid-final.png`。 |
| `media-faded-lyrics-playing.txt` | 歌词页期间 MediaSession 报告真实 `Faded` / Alan Walker、Iselin Solheim，状态 `PLAYING`。 |

P2 的真实原页行 Seek、进度 Seek、横纵拖动、CANCEL/回弹、播放往返以及黑胶累计旋转证据仍见 [P2 记录](IMMERSIVE_LYRICS_P2.md)。本轮复测期间播放列表曾自动切到同名的另一来源版本；其后 MediaSession 最近一次 position 基准与页面时间不一致，因此**本轮独立行 Seek 复测记为 inconclusive**，不把它计作 P3 通过项。P3 没有更改行 Seek 事件名称、单位或原业务处理。

## 构建环境与限制

第一次 Android 单测在 ManifestMerger 阶段失败：本机 `node_modules/react-native-pager-view/android/src/main/AndroidManifest.xml` 是 94 个零字节，无法解析。仅从锁定版本 `react-native-pager-view@6.7.1` 的 npm 包恢复了这个本地依赖文件，SHA-256 为 `3DB42D8AB171BD403758D6D56521B2412CFD938AEF5928C1B228B7EC2C805004`；没有改 lockfile、依赖版本或仓库源码。恢复后 Android 单测与 APK 构建通过。

- AVD 使用 `-no-audio`，只验证 Media3/MediaSession 状态与屏幕行为，不代表可听声音或音质验证。
- 当前自动歌词测试的真实音源在长时间验证中发生切源/URL 过期；除上述本轮行 Seek inconclusive 外，不据此归因新 UI。P2 已有的真实 Seek 验证仍有效。
- 未完成人工 TalkBack 测试、物理手机/平板测试、真机 30 分钟帧时间/热量/耗电采样、所有系统语言逐一运行、完整横屏/下载/评论/收藏持久化回归。
- 未做 Release 构建、推送、发布或清除用户应用数据。
