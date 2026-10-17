# 沉浸式空间歌词 P1：实现与验证

日期：2026-10-17（Asia/Hong_Kong）。分支 `codex/immersive-lyrics`，P0 检查点 `548e97fc`；需求与分批计划见 [实施计划](IMMERSIVE_LYRICS_PLAN.md)。本批实现空间歌词；封面取色、播放态动态背景、粒子和持久化效果设置仍属 P2/P3。

## 实现

- 保留黑胶/歌词 `lyricsVisible` 切换、原纹理/唱臂、12 秒累计旋转时钟和全部既有控制组件。
- 真实 LRC 当前句大字柔光，进入/切句一次 360ms 轻弹跳，邻句缩小减淡。正文及译文完整换行，仍为一份虚拟化列表。
- 单指超过 touchSlop 后锁方向：横向直接更新歌词位移/`rotationY`，背景柔光以较小幅度移动；释放及 CANCEL 均 spring 回正。父层不消耗纵向手势。
- 手动浏览暂停自动跟随，显示“回到当前歌词”；按钮、真实 Seek 或换歌恢复定位。进度条/底部控件位于舞台手势区域外。
- 暂停/缓冲取消弹跳，同句恢复不重新弹入；非 RESUMED 清理手势/动画。系统动画设为 0 时关闭视觉运动，仍消费横向拖动防止误 Seek。
- 歌词 Seek 校验时间/索引/范围与非有限数值，保留毫秒→秒单位；坏歌词槽位不删除，避免 activeLyric 索引错位。

没有新增音频引擎、歌词请求、模拟进度、逐字时间或 FFT，RN 不逐帧传动画。Kotlin/RN/Media3/Compose/Coil/Gradle 与 lockfile 均未升级。

## 修改文件

原生文件位于 `android/app/src/main/java/cn/toside/music/mobile/vinyl/`。

| 文件 | 改动 |
| --- | --- |
| `ImmersiveLyricStage.kt`（新） | Initial 触摸阶段方向锁定、取消子项点击、直接跟手与回弹；仅歌词舞台参与。 |
| `LyricPerspectiveController.kt`（新） | 纯数学映射、限幅与手势状态清理。 |
| `LyricMotion.kt`（新） | 当前句一次性弹跳，暂停取消。 |
| `ImmersiveVisualConfig.kt`（新） | 内部开关、系统动画设置监听、Lifecycle 限制和 Dispose 清理；没有假设置按钮。 |
| `LyricPlayback.kt`（新） | 可测试的 Seek 时间与索引校验。 |
| `PlayerLyrics.kt` | 单个 LazyColumn 的排版/柔光、浏览及跟随；强调缩放保留测量尺寸，避免整份歌词切句重排。 |
| `PlayerScreen.kt` | 组合舞台、固定暗色渐变和柔光视差；复用黑胶及底部布局。 |
| `VinylPlayerState.kt`、`VinylPlayerView.kt` | 有默认值的 `seekRevision`；坏歌词字段保护，原安全区计算保留。 |
| `src/screens/PlayDetail/Vertical/VinylPlayer.tsx` | 歌词映射仅随 LRC 改变；Seek 数值保护；订阅原 `setProgress` 事件生成一次 Seek 标记，卸载时解除，复用 MediaSession/页面既有入口。 |
| `android/app/src/test/.../LyricPerspectiveControllerTest.kt`、`LyricPlaybackTest.kt`（新） | 8 项视角/方向锁定/取消/非法几何测试，4 项 Seek/空列表/重复时间戳/长译文边界测试。原旋转测试保留。 |
| 本文及计划、`VINYL_PLAYER.md`、`CURRENT_UI.md`、根 `design-qa.md` | 功能、实测证据及未验证边界。 |

## 实际参数

drag 限制 ±0.28×舞台宽；歌词位移为 0.85×drag，最大 ±48dp；yaw 按 0.25×舞台宽归一化，最大 ±9°；相机距离为 max(500dp 换算像素, 1.2×舞台宽像素)。背景柔光位移为 0.15×drag。

释放 spring：dampingRatio 0.82、stiffness 400、像素阈值 0.2。入场：scale 0.96→1.035→1，360ms，约 +9.6dp→−8.4dp→0 轻浮动。常见屏正文 34sp，窄屏/大字号/超长句降至 30sp，邻句视觉约 18–23sp、译文 16sp。

首轮 ±72dp 横移会裁切长句，已改为 ±48dp 并预留 56dp 侧边距。最终保持触摸的左右截图已检查；长内容换行，无省略号。

## 自动检查

证据目录：`build/immersive-validation/p1/`，按仓库规则忽略，不提交二进制。

| 检查 | 结果 |
| --- | --- |
| TypeScript / 全量 ESLint | PASS；`typecheck-final.log` / `lint-final.log` |
| Node 测试 | PASS 40/40；`npm-test.log` |
| 原生单测 | PASS 15/15，0 failures/errors；`android-unit-verified.log` 和三个 JUnit XML |
| 四 ABI standalone Debug | PASS；`android-debug-delivery.log`，JS/Hermes 内置 |
| 覆盖安装 / 正式 MainActivity | PASS；`install-delivery.log` / `launch-delivery.log`，保留应用数据 |

APK：`build/apk/music-plus-v1.0.0-debug-universal.apk`，SHA-256：`c21a3f8d2d8f8879e7a545b847463527e21686e6590299d322bc8a3ce233447c`。没有阻塞构建的环境问题；已有弃用提示保留。没有 Release 构建、推送或发布。

## Android 原页证据

API 37 / Android 17 x86_64 模拟器 `MusicPlus_QA_20261017`，1080×2400、420dpi、60Hz、fontScale 1.0，SwiftShader、关闭音频输出。曲目为原业务加载的咪咕《Faded》/ Alan Walker、Iselin Solheim / Different World；未使用 Debug 演示 Activity。

| 文件（上述证据目录内） | 内容/结论 |
| --- | --- |
| `stage-final-neutral.png`、`final-right-held.png`、`final-drag-left.png` | 原生大字，DOWN/MOVE 维持触摸，左右跟手和有限透视。 |
| `final-after-right-release.png`、`final-after-cancel.png`、`pixel-checks.json` | 释放/CANCEL 后回正；歌词区域 36,736 个抽样像素差异为 0。 |
| `gesture-checks.json`、`media-final-drag-*.txt` | 暂停时左右拖动、取消和纵向滚动不改变音频位置，不误 Seek。 |
| `final-manual-browse.png`、`final-browse-after-lyric-change.png`、`browse-final-ui.xml`、`final-follow-restored.png` | 纵向浏览后暂停跟随，真实播放跨句后按钮仍保留；按钮恢复跟随。 |
| `final-row-seek.png`、`seek-and-fallback-checks.json`、`media-after-row-seek.txt` | 点行进入原播放器 Seek，约 38.1s→45.5s（含恢复后的短暂走时），曲目不变。 |
| `final-progress-seek.png`、`media-after-progress-scrub.txt` | 原进度条拖动有效，最后复测位置约 86.0s。 |
| `motion-off-neutral.png`、`motion-off-held.png` | 系统动画设为 0 时无平移/透视/误 Seek；36,736 个区域抽样像素无差异；测试后恢复系统原值 null。 |
| `vinyl-before-mode-roundtrip.png`、`vinyl-after-mode-roundtrip.png` | 暂停时黑胶→歌词→黑胶，唱片区域 23,408 个抽样像素相同，角度不重置。 |
| `narrow-stage-320x640-font-1.3.png`、`narrow-stage-scroll.png` | 840×1680 / 420dpi，即 320×640dp；字号 1.3，歌词换行、滚动及底部控制/安全区可见。已恢复原分辨率与字号。 |
| `favorite-toggled.png`、`button-checks.json`、`queue.png`、`song-info.png`、`download-tool.png`、`comments.png` | 收藏切换并恢复原状态；原工具入口打开。下载仍需真实文件夹授权，未执行传输；评论返回匹配版本的空结果，未制造条目。 |
| `gestures-verified.mp4` | Android 录屏：左右跟手/回正/取消、纵向浏览、切句、恢复跟随和部分原控制。 |

像素抽样用于固定暂停场景，不代表帧率达标。MediaSession position 是上次更新的基准；Seek 在恢复/暂停后核对实际位置，原始时间换算另有单测。

## 未完成与限制

- P2 封面调色、动态漂移和粒子尚未实现；背景当前为固定安全深色配色和触摸视差。没有实时声学节拍或频谱。
- 未完成完整 TalkBack、双语长译文原页、低端/高刷真机、30 分钟耗电/发热、长期后台、真实通知 Seek、蓝牙和可听音质验证；不宣称 60fps 或整套需求完成。系统 Seek 事件接入已静态核对，实体通知操作未实测。
- 队列/信息/下载/评论只测入口；下载传输/SAF、收藏重启持久化、上下首及全来源回归未完成。
- 本批未重做无歌词/封面失败、快速切歌、实际网络缓冲和后台恢复的完整矩阵；空列表/坏时间等仅有相应纯逻辑测试，不能等同原页验收。
- 修改系统字号会重建 Activity 并回首页；已重新进入原生页验证窄屏大字。现有 Manifest 未声明处理 fontScale，本批未扩大改造导航恢复。
- 启动权限提醒会阻挡自动化：一次点按早于提醒出现而超时，处理真实提示后重测成功，未清数据或注入测试歌词。软件渲染即时截图可能含未稳定帧，交付保持触摸截图在稳定后采集。

## 复现与回滚

使用 [现有 Android 工具链](ANDROID_BUILD.md) 运行表内 npm 检查、`android/gradlew.bat :app:testDebugUnitTest --console=plain --max-workers=2` 和 `npm run pack:android:debug`，覆盖安装 APK，启动 `io.github.musicplus.player/cn.toside.music.mobile.MainActivity`，从原业务播放有歌词歌曲后点唱片/曲名进入歌词。

在本次 1080×2400 设备可使用 `adb shell input motionevent DOWN 540 830`、`MOVE 820 830`、`UP 820 830` 或 `CANCEL 820 830` 重现保持触摸；其他设备需按真实舞台调整坐标。手动浏览应显示恢复按钮，点行/拖进度应真实 Seek。测试脚本、媒体状态和截图留在证据目录。

P1 为独立提交，可 revert 本批恢复 P0；不要 hard reset 或删除用户需求。测试结束暂停播放，恢复系统设置。后续 P2/P3 在同分支分批实施。
