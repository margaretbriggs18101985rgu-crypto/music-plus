# 黑胶播放器（当前实现）

现有 React Native 0.73.11 / React 18.2.0 工程内迭代，竖屏详情由 Kotlin / Compose 原生组件呈现，继续使用原 TrackPlayer / Media3 音频服务。没有第二套模拟播放器。最初需求文档位于 Android_Vinyl_Player_Codex_Package；后续用户截图和交互修正优先，当前外观与操作说明见 [当前界面](CURRENT_UI.md)。

开发顺序：保留原逻辑 → 原生黑胶组件与累计角度 → 实际播放状态桥接 → 歌词/队列/资料/下载/评论 → 全应用主题与原生验收。

## 组件

原生目录：android/app/src/main/java/cn/toside/music/mobile/vinyl/。

| 文件 | 职责 |
| --- | --- |
| PlayerScreen.kt | 暖灰渐变、安全区、按高度缩放唱片、歌词模式与固定控制 |
| VinylRecord.kt | 缓存真实沟槽/反光纹理，封面和唱片整体旋转 |
| VinylRotationClock.kt | 12 秒/圈累计角度；暂停保留角度、恢复继续 |
| Tonearm.kt | 白色弯曲唱臂、轴承、唱头；独立支点与停止回位 |
| SongInfo.kt | 标题/歌手、收藏红心、右侧评论入口 |
| PlayerLyrics.kt | 原 LRC 数据、活动行、自动跟随、点击 seek、边缘淡出 |
| PlaybackProgress.kt | 真实时间、拖动预览、松手 seek |
| PlaybackControls.kt | 模式循环切换、上下首、播放/暂停、队列 |
| PlayerNavigation.kt | 收起、曲名/歌词切换、更多，底部歌曲信息/下载 |
| VinylPlayerView.kt | RN 状态与事件桥接、安全区 |
| MusicDownloadModule.kt | 系统目录/封面选择、真实下载、完成后持久保存与文件打开 |

RN 桥接：src/screens/PlayDetail/Vertical/VinylPlayer.tsx。真实状态来自既有插件；缓冲/暂停不会转动。歌词、seek、上下首、收藏都连接原业务。评论页为 src/screens/Comment/OfficialComments.tsx，队列及资料/下载面板位于 src/components/player/。

更多播放设置仍能进入原竖屏组件，横屏原功能保留。播放器不重复展示主导航，不含福利、会员、虚假评论数或无功能入口。

## 构建和测试

JDK 17 / AGP 8.10.1 / Gradle 8.11.1 / Kotlin 1.9.24；Compose 1.7.8 / Compiler 1.5.14 / Coil 2.6.0。

- npm run pack:android:debug：四 ABI 独立调试 APK，JS/Hermes 内置。
- android/gradlew.bat :app:testDebugUnitTest：3 项旋转时钟单元测试。
- tools/test-vinyl-animation.py：Debug 动画场景；build/vinyl-validation/rotation-delivery/animation-results.json 记录暂停角度不变、续转及元数据刷新不中断。此脚本不作为音频播放测试。
- 真实在线歌曲与 SAF 保存的 MP3 已分别通过原服务播放并从系统 MediaSession 观察到 PLAYING 和真实进度；歌词与下载使用真实数据。
- 既往本地 WAV 的 seek、上下首、短时后台与系统媒体键证据保留在 build/vinyl-validation；本次最终原生截图和窄屏记录见根目录 design-qa.md。

Debug 演示 Activity 明确标记无音频，保留用于动画测试。正式 APK 的源、搜索、歌单、同步、导入等业务不依赖演示数据。

尚需真机复验：可听声音/音质、长期后台和厂商省电策略、蓝牙/耳机、其他系统版本与第三方源长期稳定性。API 37 模拟器验收不能替代这些测试。

## 2026-10-17 空间歌词 P1

歌词页加入大字柔光、切句轻弹跳、横向跟手平移/有限透视/释放回弹和静态深色背景视差。仍用一个 `PlayerLyrics` 虚拟列表及原 TrackPlayer/RN 桥；纵向浏览暂停跟随，点击“回到当前歌词”恢复。系统动画关闭时停止视觉运动，并防止横拖误触 Seek。黑胶时钟和原底部控件继续复用。

新增 Stage/Perspective/Motion/VisualConfig/Playback 小组件和 12 项单测，连同原旋转测试共 15 项通过。四 ABI Debug 构建和 API 37 原页交互已验证，证据/参数/限制见 [P1 记录](IMMERSIVE_LYRICS_P1.md)。封面取色、粒子及持久化动效设置尚未加入，P1 不代表全部沉浸式功能完成。
