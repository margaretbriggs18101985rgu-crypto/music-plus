# 沉浸式歌词 P2：封面氛围与粒子

日期：2026-10-17（Asia/Hong_Kong）。分支 `codex/immersive-lyrics`，从 P1 `1fbbd488` 继续。用户需求目录仍未跟踪，两个原文件 SHA-256 与 P0 相同；未清理、重置或纳入提交。需求仍以用户实施文档为唯一新增基线。

P2 已实现并完成下述分层验证；P3 持久化设置、模式过渡及专项 QA 尚未实施。没有修改 RN/TrackPlayer/Media3、歌词解析、控制事件、安全区或黑胶累计时钟，没有增加音频、歌词请求或声学频谱。

## 实际文件与参数

原生主目录为 `android/app/src/main/java/cn/toside/music/mobile/vinyl/`。

| 文件 | 改动与理由 |
| --- | --- |
| `PlayerArtwork.kt`（新增） | 把唱片原来的 Coil 请求提升为共享 painter，唱片和取色使用同一次成功加载；沿用 User-Agent、应用级 ImageLoader 和缓存。请求显式 512px、软件位图、300ms 图片淡入，歌词模式隐藏唱片也能完成加载。按 trackId/URL/UA 重建及取消旧 painter；后台取色协程随其取消。 |
| `AmbientPalette.kt`（新增） | 后台从成功位图约 32×32 样本、RGB 四位分桶取代表色；忽略透明/近黑/近白，约束亮度和饱和度。缺封面/失败/纯白/纯黑回退到原 VinylPalette 的深色版本。纯函数可独立测试。 |
| `AmbientAnimationClock.kt`（新增） | 只计视觉时间；pause 清帧基准、保留相位，恢复排除休眠时间，单帧增量最大 50ms。绝不驱动音频位置或歌词索引。 |
| `AmbientBackground.kt`（新增） | 700ms 配色过渡，4 个缓存径向渐变柔光、缓慢正弦漂移和 20% 黑遮罩；背景拖动 0.15×。播放/暂停强度 0.20/0.11，240ms 弱化。无逐帧 Bitmap、全屏 Blur 或随机参数重建。 |
| `AmbientParticles.kt`（新增） | 按曲目稳定种子一次创建小粒子；Auto 32、Low 16、High 42、Off 0，低内存设备上限 16。另绘制 4 个柔光点（Low 为 2）；远/中/近横向视差 0.15/0.30/0.45×。粒径 0.65–1.8dp，缓慢漂移、低透明闪烁，边缘淡出；颜色同步 700ms 过渡。装饰层无触摸处理且不进入无障碍树。 |
| `ImmersiveVisualConfig.kt`（扩展） | 内部总开关/粒子档位/背景运动/歌词运动，观察 RESUMED、系统动画比例及 PowerManager。后台、省电或系统动画关闭时停视觉帧循环、移除粒子；低内存降档。观察者/广播接收器在 Dispose 移除。 |
| `PlayerScreen.kt`（修改） | 仅组合共享封面、取色、独立背景/粒子；不把逐帧 phase 值读到整页组合。实际 isPlaying 且前台且歌词模式才运行环境时钟。原固定控制、原安全区和黑胶模式布局保留，Debug 日志只在策略/运行状态改变时输出。 |
| `VinylRecord.kt`（修改） | 读取共享 painter，保留圆形封面、错误标签及原纹理/旋转/Lifecycle。取消原重复图像请求；仍将封面和纹理放在同一个累计旋转图层。 |
| Debug `VinylPreviewActivity.kt`、3 张 32px PNG | 扩展已有、明确标注“界面演示 · 非音频播放”的工具，供红/蓝/白封面、空/坏 URI 和档位测试。PNG 是确定像素的测试夹具，仅 Debug 资源；没有注入歌词、播放进度或音频数据。 |
| 4 个对应 `*Test.kt`（新增） | 14 项纯逻辑单测：取色/透明/亮度回退、相位暂停/异常帧、档位/生命周期/省电/低内存策略、粒子种子/范围/三层视差参数。保留 P1 的全部 15 项测试。 |

配色参数是本批实测值。黑胶页继续原暖灰背景；P2 氛围仅用于歌词页。内部配置尚无用户可见假开关，P3 再沿用原设置架构持久化。

## 编译和自动检查

保持原 Node 24.22.0、JDK 17、RN/Kotlin/Compose/Coil/Gradle 版本；没有重装 node_modules、改 lockfile 或引入依赖。

| 检查 | 结果 | 证据（`build/immersive-validation/p2/`） |
| --- | --- | --- |
| `npm run typecheck` | PASS | `typecheck.log` |
| `npm run lint` | PASS | `lint.log` |
| `npm test` | PASS，40/40，无跳过 | `npm-test.log` |
| `android/gradlew.bat :app:testDebugUnitTest --console=plain --max-workers=2` | PASS，29/29，0 failures/errors，39s | `android-unit.log`、7 份 `TEST-*.xml` |
| `npm run pack:android:debug` | PASS，四 ABI standalone JS/Hermes Debug，24s | `android-debug.log` |
| 覆盖安装、MainActivity 启动 | PASS，保留应用数据 | `install.log`、`launch.log` |
| 用户需求哈希、最终媒体状态、系统恢复 | PASS | `requirements-unchanged.json`、`device-restored.json`、`media-final-confirmed.txt` |
| `git diff --check` | PASS | 本批提交前执行 |

APK：`build/apk/music-plus-v1.0.0-debug-universal.apk`，78,121,140 字节，SHA-256 `6498ad94acbf9937bb24dc110276f8ce8c19d275c42477d4f91b74749187c7f3`。没有 Release 构建、推送、发布或改动外部服务。

构建环境没有阻塞问题。现有 deprecated system bar / RN emitter API 和 Gradle 9 兼容提示仍存在。辅助 PowerShell 脚本直接运行曾被本机 ExecutionPolicy 拒绝；随后执行已保存的同段脚本内容完成像素比较，没有修改系统策略。此项是测试调用方式问题，不是 Android 构建失败。

## Android 实测与证据

沿用 AVD `MusicPlus_QA_20261017`，Android 17 / API 37，x86_64，1080×2400、420dpi、60Hz、fontScale 1.0，SwiftShader，无音频输出。正式 MainActivity 播放咪咕来源《Faded》/ Alan Walker、Iselin Solheim / Different World；实际歌词、封面和状态继续经原桥。设备证据均为本批 APK 重新采集；P0/P1 历史目录未覆盖。

| 验证 | 实际结果与证据 |
| --- | --- |
| 大字、配色、粒子与真实播放 | `stage-final-neutral.png`、`playing-a.png` / `playing-b.png`；背景边缘避开正文的 1,120 个抽样像素有 584 个变化，暂停后相同区域冻结。`media-ambient-playing.txt` 为 PLAYING。像素变化不能代替帧率测量。 |
| 左/右保持、松手和 CANCEL | `final-right-held.png`、`final-drag-left.png`、`final-after-right-release.png`、`final-after-cancel.png`；回正场景 36,736 样点差异 0。MediaSession 暂停位置保持一致，没有误触 Seek，见 `gesture-checks.json`。 |
| 纵向浏览与恢复跟随 | `final-manual-browse.png`、`final-browse-after-lyric-change.png`、`browse-final-ui.xml`；真实播放 6 秒后仍有“回到当前歌词”，点击恢复，滚动没有 Seek。 |
| 原行 Seek / 进度拖动 | `seek-and-fallback-checks.json`：行点击后暂停位置从 38,169ms 变为 45,500ms；进度拖动后为 85,371ms。保留原 MediaSession 原始日志，没有模拟进度。 |
| 暂停冻结 | `paused-a.png` / `paused-b.png` 间隔 2 秒；正文舞台 36,736 样点差异 0，见 `pixel-checks.json`。光强收敛后才采样。 |
| 前后台 | HOME 后媒体仍 PLAYING，返回 MainActivity 继续同曲。`ambient-lifecycle.log` 中 13:44:26 停止于 phase 15.649999，13:44:28 从同相位恢复；没有补播后台时间。`returned-from-background.png` 与对应媒体日志。 |
| 系统动画关闭 | 正式播放继续，策略 particles=0 / animate=false；两张 `playing-motion-off-*.png` 背景边缘 1,120 样点差异 0。暂停横拖也不动且未 Seek，`motion-off-*.png` 舞台样点差异 0。设置最终删除，恢复原 null。 |
| Android 系统省电 | 模拟器 battery unplug + `cmd power set-mode 1`，`power-save-dumpsys.txt` 确认 BatterySaver Enabled/full=true；真实 MediaSession PLAYING，`power-save-native.log` 为 particles=0、animate=false。`real-power-save.png`；最后 set-mode 0 / battery reset，恢复充电及低电量设置 0。不是实体电池/耗电测量。 |
| 黑胶、模式与旋转保护 | 暂停模式往返唱片区域 23,408 样点差异 0；另采集 `real-vinyl-paused.png` / `real-vinyl-playing.png`，实际播放黑胶→歌词→黑胶的三个媒体快照均 PLAYING。原累计时钟 3 项测试通过，旋转循环未改。 |
| 窄屏/放大字体 | `narrow-stage-320x640-font-1.3.png`、`narrow-stage-scroll.png`：840×1680 / 420dpi，实际 320×640dp、fontScale 1.3，正文换行、可浏览、底部控制与安全区可见。恢复原尺寸/字体。 |
| 原控制入口 | `button-checks.json`、`favorite-toggled.png`、`comments.png`、`queue.png`、`song-info.png`、`download-tool.png`。收藏切换并恢复；评论版本匹配后空结果；其他工具入口打开。没有宣称真实下载完成。 |
| 短录屏 | `real-lyrics-ambient.mp4`，83.7456 秒，10,617,099 字节，已等 screenrecord 退出后拉取并检查 moov/mvhd，见 `recording.json`。包括横拖/回弹、纵向/Seek、原控制、黑胶往返、播放粒子、暂停及后台/减少动画操作。无 Debug 演示夹具混入。 |
| 错误检查与清理 | `errors-final.log` 本次 AndroidRuntime / ReactNativeJS error 查询为空。最终 `media-final-confirmed.txt` 为 PAUSED，系统设置见 `device-restored.json`；测试 AVD 关闭。日志查询不能代表全部业务无错误。 |

### 独立 Debug 视觉验证

`debug-cover-red.png` / `debug-cover-blue.png` 的暗色背景跟随不同封面；`debug-cover-white.png` / `debug-cover-missing.png` / `debug-cover-invalid.png` 均回到安全灰暗色，空歌词保留正常空态。全部截图带无音频演示标识，不能作为真实歌词/音频同步证据。

`debug-quality-low.png` / `high.png` / `off.png` / `auto.png` 和 `debug-fixtures.log` 分别对应 16/42/0/32 粒子；effects off 同时停环境时钟。连续三轮快速红→蓝后，`debug-rapid-final-blue.png` 与初次稳定蓝色舞台 36,736 样点差异 0，没有旧红配色覆盖；这次命中内存缓存，不等于验证了所有慢网络异步顺序。原真实 MediaSession 在整个演示期间保持暂停。

## 边界与未验证事项

- P3 持久化设置、模式过渡、完整 TalkBack/双语长译文/空曲目矩阵尚未实施或未验收；不宣称全部需求完成。纯逻辑测试不能替代无障碍服务操作。
- NOT RUN：中低端实体设备、高刷/其他 API、可听声音、蓝牙/通知控制、30 分钟稳定性、可比帧时间/卡顿/内存峰值/功耗/发热，长期锁屏和厂商后台策略。软件渲染录屏与像素比较不能证明 60fps；低内存设备上限只在单测验证，不称为低端真机性能通过。
- NOT RUN：真实慢网络封面竞争/损坏解码器/动图封面、整套快速切换真实歌曲矩阵、实际网络缓冲与恢复。本批正式曲目读取 Coil DISK/MEMORY_CACHE；受控夹具覆盖色彩/错误回退，不能代替这些网络测试。
- 队列重排、上下首/全部音源、收藏重启持久化、评论分页、下载传输和 SAF 仍须后续回归。P2 没有修改这些业务；只完成所列入口和收藏切换检查。
- 字号变化重建 Activity 并返回原 RN 首页，已重新进入正式原生页测试；这是既有导航恢复边界，未扩大修改 Manifest。
- 省电复原后立即注入的清理点按曾未生效，真实媒体状态断言捕获失败（`final-initial-assertion-failed.log`、`power-input-os-transition-failed.log`）。已定位：`system-transition-input.log` 的 InputDispatcher 在 13:52:15.477 明确报告系统 transition snapshot 遮挡 `(540,2080)` 并丢弃触摸。未关闭系统触摸保护；测试等待系统过渡结束后重跑两轮，首次点按均真实 PAUSED，见 `power-input-repeat.json` / `.log`。这属于设备自动化时序限制，不能用发出 tap 代替媒体状态断言；仍需实体设备复验系统省电。

## 复现与回滚

沿用 [Android 构建](ANDROID_BUILD.md) 工具链运行表内命令，`adb install -r build/apk/music-plus-v1.0.0-debug-universal.apk`，启动 `io.github.musicplus.player/cn.toside.music.mobile.MainActivity`。播放有实际歌词的歌曲，点击唱片/顶部曲名进入舞台；暂停后比较冻结、水平拖动再松开、竖向浏览、点击真实行 Seek，并检查媒体状态。

Debug 夹具仅用于补充：启动 `io.github.musicplus.player/cn.toside.music.mobile.vinyl.VinylPreviewActivity` 后，通过 `am start -W -n <同组件> --es vinyl_action lyrics` 切歌词，再发 `ambient-red/blue/white/missing/invalid`、`ambient-low/high/off/auto`；`resume/buffer` 仅控制演示视觉，没有音频服务或伪造歌词。正式证据不要从此 Activity 采集。

本地脚本、完整日志及媒体证据在忽略目录 `build/immersive-validation/p2/`，前后对照用 P1 的 `stage-final-neutral.png` 与本批同名文件；不要把 P1 静态背景图作为 P2 结果。P2 单独提交，需回滚时 revert 对应 P2 提交即可回到 P1；不要 reset 或删除用户需求文件。无推送或发布。
