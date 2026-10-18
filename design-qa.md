# 原生黑胶播放器视觉与交互验收

## 2026-10-17 空间歌词 P2 增量

- 已接入共享 Coil 封面取色、700ms 暗色配色过渡、4 个柔光与 Auto 32 / Low 16 / High 42 个三层视差粒子。黑胶布局/累计时钟及真实音频/歌词桥保持原实现。
- TypeScript、ESLint、40 项 Node 测试、29 项 Android 单测与四 ABI standalone Debug 构建通过，覆盖安装成功。真实《Faded》原页回归横/纵拖动、回弹/CANCEL、行/进度 Seek、暂停/播放和黑胶往返。
- 暂停舞台 36,736 抽样像素差异为 0；HOME/返回继续同一真实播放且视觉相位不补播后台时间。系统动画关闭和 Android 省电实际使粒子归零、停止环境时钟。320×640dp / fontScale 1.3 正文可浏览，控制栏/安全区可见。
- 红/蓝/白/缺失/失败封面及粒子档位在明确标注无音频的 Debug 工具验证；快速红蓝替换最终配色正确。这些夹具不是实际歌曲/音频证据。83.7456 秒录屏全部来自正式 MainActivity。
- 本次证据在 `build/immersive-validation/p2/`，文件清单、参数、校验值、测试边界及回滚见 [P2 记录](doc/IMMERSIVE_LYRICS_P2.md)。P3 设置/模式切换已实施；完整无障碍、真机 30 分钟性能/耗电和下载传输仍未验收，不宣称 60fps。省电复原后立即注入的点按曾被 Android 过渡快照阻挡，InputDispatcher 日志已定位；等待系统过渡完成后两轮暂停复测通过，保留原失败与定位证据。

下方 P1 和更早记录为历史阶段事实，其“尚未实施”描述以对应阶段为限。

## 2026-10-18 空间歌词 P3 增量

- 新增 RN 持久化设置，控制总特效、歌词/背景运动、系统减少动画与 Auto/Low/High/Off 粒子档位；Compose 原生读取同一 TrackPlayer 状态桥配置。模式切换增加 300ms Crossfade，减少运动时即时完成；底栏和累计黑胶时钟仍在原页面状态中。
- TypeScript、ESLint、42 项 Node 测试、31 项 Android 单测及四 ABI standalone Debug 构建通过。API 37 AVD 上通过设置界面验证关闭效果、Low 档、强制结束后保留，再恢复默认启用/Auto；实际歌词页关闭特效仍显示 LRC。19.068 秒录屏含黑胶/歌词和快速反向切换。
- 本轮设备工作期间播放源自动切换且 position 快照与页面时间不一致，P3 单独行 Seek 复测记为 inconclusive；P2 已有真实行 Seek 通过证据。无人工 TalkBack、物理真机听感或 30 分钟性能/功耗数据。
- 截图、录屏、构建环境修复、校验值和边界见 [P3 记录](doc/IMMERSIVE_LYRICS_P3.md)；P3 证据文件位于 `build/immersive-validation/p3/`。

## 2026-10-17 空间歌词 P1 增量

- 已实现大字柔光/切句弹跳、横向直接跟手及 ±9° 透视、背景 0.15 倍视差、释放/CANCEL 回弹。实测收紧横移至最大 ±48dp，并预留文字边距。
- 仍为单个真实歌词 LazyColumn；纵向浏览暂停跟随，恢复按钮及原 Seek 事件标记重新定位。保留毫秒→秒单位，系统动画关闭时仍能浏览/Seek 并防横拖误触。
- TypeScript、全量 ESLint、40 项 Node 测试、15 项原生测试和四 ABI standalone Debug 构建通过。API 37 原页验证横/纵手势、行/进度 Seek、暂停恢复、黑胶往返；暂停唱片区域抽样像素保持一致。
- 320×640dp、fontScale 1.3 原生页已检查，正文换行且控制/安全区可见。收藏切换并恢复，评论/队列/信息/下载入口可打开；下载传输、收藏重启持久化和全来源回归未完成。
- 证据目录 `build/immersive-validation/p1/`；文件索引、参数和限制见 [P1 记录](doc/IMMERSIVE_LYRICS_P1.md)。P2 动态封面背景/粒子及 P3 设置尚未实施；没有真机听感、完整 TalkBack 或可比性能/发热耗电数据，不宣布全部需求或 60fps 目标完成。

日期：2026-10-17。范围：阶段 A 原生播放页、阶段 B 核心动画，以及已有 Media3 播放器与新界面的连接。不是整个需求包全部阶段完成声明。

## 2026-10-17 页内切换复核

- 平台选择、榜单类型和歌单分类均在当前页面展开，点击后立即更新选中态；没有使用切换弹窗。
- 排行榜 QQ/网易云平台切换：`build/qa-leaderboard-wy.png`；榜单类型展开和收起：`build/qa-final-leaderboard-expanded.png`。
- 发现歌单平台标签和分类展开：`build/qa-final-songlist-expanded.png`；歌单页选中平台保持下划线状态。
- 通过实际 API 数据确认切换后列表内容随平台刷新，播放器迷你条和底部导航保持固定，不遮挡切换控件。

**final result: passed**

本范围内没有尚待修复的 P0/P1/P2 视觉问题。阶段 C 未完成项和未运行的验证在下方单独列出。

## 视觉依据与环境

- 源图：`D:/MUSIC++/Android_Vinyl_Player_Codex_Package/reference_player.jpg`，706×1536 px。
- 需求：同目录 `README_FOR_CODEX.md`，已完整阅读；用户随后明确要求每个新增按钮必须有对应功能，不照搬福利、心动等业务。
- 最终原生截图：`D:/MUSIC++/doc/ui/vinyl-player-android.png`，706×1536 px。
- 实际设备：Android API 37 x86_64 模拟器 `emulator-5554`，视口 392.2×853.3 dp、density 1.8；与源图等像素尺寸并排比较，没有缩放某一侧冒充等尺寸。
- 状态：暂停、白色唱臂落针、圆形封面、喜欢已选。原创城市照片用于明确标记的 Debug 演示，不复制参考图中的艺术家封面，不伪造音频已播放。
- 原生实现为现有 RN 工程内的 Kotlin/Compose；按用户要求用 Canvas 绘制黑胶/唱臂与渐变，不套用网页模板，不用截图裁片/GIF 冒充组件。状态栏、时间、电量、手势条来自真实 Android 系统。

## 对照证据

参考在左、实现右，已实际打开组合图进行比较：

- 最终全屏：`build/vinyl-validation/comparison-v4.png`。
- 最终唱片/唱臂放大：`build/vinyl-validation/comparison-v4-record.png`。
- 歌曲信息/图标/进度/控制/底栏放大：`build/vinyl-validation/comparison-v3-controls.png`；该区域与最终版本相同。
- 正式 RN 接入页：`build/vinyl-validation/formal-final.png`（本地 WAV、缺封面状态），`doc/ui/vinyl-real-audio-android.png`（真实进度）。内容状态与源图不同，用于检查正式容器与实际数据，未作封面图像一致性声明。
- 窄屏：`build/vinyl-validation/narrow-top-final.png`、`narrow-controls.png`、`narrow-long-title.png`、`narrow-empty.png`；合并证据 `narrow-qa-sheet.png`。640×1280 px = 320×640 dp、density 2.0。
- 窄屏保持较大唱片，主体允许纵向滚动；控制区可滚动到达，底部导航固定。长标题省略不覆盖收藏/更多。空状态控制置灰、唱臂回位，缺封面显示统一标签。

## 五项必要视觉检查

| 检查面 | 结果与依据 |
| --- | --- |
| 字体/层级 | Android 系统中文与西文字体；歌名 20sp 半粗、歌手 15sp、导航 17sp、时间 11sp。已修正早期过粗过大标题；长标题省略，缺少歌手显示“未知歌手”。没有从源图裁切文字，也不复制被裁切的歌名。 |
| 间距/布局 | 常见屏唱片直径约屏宽 80%，封面为唱片 64.5%；中心、唱臂支点、信息区与底部控制位置接近参考。阴影固定，唱片/封面整体旋转。短屏用滚动保留圆形和可用按钮，不横向溢出。 |
| 色彩/令牌 | 连续 #34465F → #28374D → #192334；柔白 #F3F4F6、灰色次要文字、红色喜欢。JPEG 源图色值略有差异，采用需求文档指定的蓝灰范围；没有突兀卡片/高饱和霓虹。 |
| 图像/质感 | 原创 1254×1254 城市照片圆形中心裁切，无拉伸；唱片缓存 1024px 纹理，细密沟槽与低对比反光可在放大图中辨认。唱臂为独立 Canvas，支点固定，不跟随唱片。上下首采用官方 Material 矢量，其他图标复用工程字体和 Material 爱心。 |
| 文案/内容 | 按用户要求不照搬福利、心动、播客、笔记、评论、人数/收藏数、VIP、音质标签。正式页顶部“唱片/歌词/歌单”，底部“返回/搜索/歌单/设置”。演示仅显示可用标签并标记无音频；未知时长为 --:--。 |

## 比较历史与已修复问题

| 轮次 | 发现 | 修改 | 修后证据 |
| --- | --- | --- | --- |
| V1，blocked | [P2] 唱片偏高、控制键过散、上下首为多重箭头；标题/菜单/搜索偏大。 | 唱片从 .82 屏宽调到 .80、调整舞台留白；控制行水平边距 .21 屏宽，播放 36sp；使用官方单次 skip 图标，缩小文字和导航图标。 | `comparison-v1.png` → `comparison-v2.png`；均为参考与原生截图组合。 |
| V2，blocked | [P2] 按用户最新要求，福利等未经实现的业务入口不应出现在新页。 | 删去福利/心动/播客/评论/笔记与装饰计数；改为已有歌词/歌单与实际 App 页面。 | `comparison-v3.png`、`comparison-v3-controls.png`；正式页逐项点按。 |
| V3，blocked | [P2] 正式 RN 容器使用旧缓存的状态栏高度，缩放后菜单上沿为 y=143，原生演示为 y=94；“返回首页”实际只关闭详情。 | 原生容器使用当前 WindowInsets 和实际窗口位置，避免重复避让；按钮明确改为“返回/返回主界面”。 | `formal-player.png` → `formal-final.png`，菜单上沿恢复 y=94；`comparison-v4.png` 与唱臂放大图复查通过。 |
| V4，passed | 无新 P0/P1/P2。 | 复核完整页面、放大区域、窄屏、空状态及真实播放器。 | 最终 APK 实际安装；截图和 JSON 报告见下。 |

V1–V3 的发现已关闭。依赖/构建故障修复没有被计作视觉迭代。

## 已运行的交互与工程检查

- 正式播放详情：菜单、返回、搜索、歌单、设置、歌词页及返回黑胶、歌曲信息弹窗；全部有实际目标，无“待实现”菜单。
- Debug 原生演示的搜索/歌单通过桥接打开真实 RN 搜索输入框和已持久化曲库：`debug-handoff-search.png` / `debug-handoff-library.png`。
- 真正的本地 WAV：自行生成 300 秒 220Hz PCM WAV，经原有文件打开流程接入 Media3。新页原生播放/暂停改变真实媒体会话状态；拖动到约 02:56 后恢复位置为 176400ms；后台系统媒体键播放后暂停位置 178511ms。详见 `build/vinyl-validation/real-audio-results.json`。
- 真实播放时两帧唱片区域不同；暂停后唱片区域像素差为 0，排除了仅图标切换而唱片继续旋转的问题。
- 两首本地音频切歌 A→B、B→A 与收藏状态、进程重启后的收藏保留通过：`build/vinyl-validation/queue-results.json`。
- 精确角度的 Debug 自动检查：暂停 72.499997°→72.499997°；恢复从该角度继续，资料刷新不中断。`build/vinyl-validation/final/animation-results.json`。
- `npm ls --depth=0`、完整类型检查、ESLint、Android 编译通过；旋转时钟 3 项单测通过。
- `build/vinyl-validation/android-build-delivery.log`：最终四 ABI Debug 构建成功；APK 已安装启动、内置 JS/Hermes、签名及 ZIP 对齐校验通过。
- `AndroidRuntime` / `ReactNativeJS` 检查未出现本次测试路径的崩溃日志。Android 原生截图和媒体会话是验收依据，没有用浏览器预览代替。

## 未完成/未覆盖的范围

- 新增系统文件选择器导入尚未实现；洛雪原有文件打开与目录导入保留。完整阶段 C/D 仍需继续。
- 模拟器使用 `-no-audio`；实际媒体引擎运行已验证，可听声音与音质需真机验收。
- 通知面板内按钮、实体耳机/蓝牙、长期后台/休眠/厂商策略尚未验证；这里只验证短时后台与系统媒体键。
- 网络真实缓冲、解码失败、两首不同真实封面的淡入淡出、在线音源、同步端到端、大字号与完整横屏回归尚未覆盖。
- 无 TalkBack 人工遍历或专项性能/内存基准；已提供按钮语义名称、约 48dp 点击区域及禁用状态，未据此宣称完整无障碍通过。

## Implementation Checklist

- [x] 可运行的 Compose 播放页、独立黑胶/唱臂/信息/进度/控制组件。
- [x] 真实截图全图与关键区域组合比较，修复本范围 P0/P1/P2。
- [x] 窄屏、长标题、空状态与无封面检查。
- [x] 保留旧业务功能并接通真实播放命令，完成本地音频联动检查。
- [x] APK、校验文件、构建命令、测试结果与剩余范围交付。

**Follow-up Polish**

- [P3] 获得用户歌曲后继续检查不同封面主色、极长歌手名和系统大字号；不影响当前阶段 A 交付。

final result: passed



## 2026-10-17 后续界面清理

- 搜索框下方的来源标签行已移除；搜索仍使用已保存的默认来源并保留原有结果加载逻辑。
- 黑胶播放器顶部的三点菜单及旧版播放器切换入口已移除；黑胶页仍保留歌词、播放队列、歌曲信息、下载、评论和播放控制。
- 评论页按参考图调整为歌曲信息、评论数、平台与热门/最新页内切换、评论列表。只显示现有数据和可用操作，没有添加发布、点赞、笔记或相机按钮。
- 类型检查、完整 ESLint、15 项数据合约测试和 Android Debug 构建全部通过。
- `emulator-5554` 覆盖安装并启动成功。模拟器截图确认搜索首页来源标签行已移除、真实搜索仍返回歌曲、黑胶页没有顶部三点菜单。评论页真实加载网易云 172 条评论；切到 QQ 最新时真实返回评论，接口总量字段不一致时正确显示“20+”。最终评论截图：`build/qa/ui-cleanup-comments-final.png`、`build/qa/ui-cleanup-qq-latest-final.png`；首页和播放器截图：`build/qa/ui-cleanup-home.png`、`build/qa/ui-cleanup-vinyl.png`。
- Debug APK：`build/apk/lx-music-mobile-v1.9.1-debug-universal.apk`；SHA-256：`13b5b5165d93faa2b5725d1b7745d09115ff0c8ca26275cd78e5a9652a483d5f`。

## 2026-10-18 v1.1.1 播放器更多面板与播放同步

- 视觉来源：用户提供的 `83d6d74b34f0ce5cad6538ced98547d3.jpg`（1220×2656）。原生实现初版截图 `build/player-menu-qa.png`（1080×2400，411dp 宽、2.625 密度）。
- 将两张图按相同 540px 宽归一化，保留各自纵横比，生成 `build/menu-qa/comparison-v1.png`；歌曲、封面、平台会员/关注按钮及系统状态栏为动态内容或本产品差异，不复制参考图数据。局部检查：`build/menu-qa/details-v1.png`。
- V1 [P2] 面板起点较参考偏低，行高及字号略大，降低信息密度。已将高度改为窗口的 74%，行高 54dp，正文 15、标题 17，并减少头部及快捷操作留白。
- 已检查字体、布局、颜色、图片和文案；使用当前歌曲真实封面和 Feather 字体图标，保留本产品真实功能。底部系统导航栏由 Android 管理。

- V2：同一输入中对照参考图与实际 APK 截图，见 `build/menu-qa/comparison-v2.png`、`details-v2.png`。字体、留白、深色底与分隔线、真实封面、图标及文案已复查，无本范围待修复 P0/P1/P2。
- 交互复测发现 [P1] 仅用移动判定会丢失下拉手势；抓手开始触摸即取得响应后修复。最终安装包在 `[0,708][1080,766]` 抓手区域向下滑动，确认面板关闭、底层播放器恢复交互，见 `build/menu-qa/drag-dismiss-fixed.png`。
- 已实际验证睡眠定时开始／取消、单句切换多排、樱粉颜色、字号／对齐面板、音量／倍速面板、播放列表跳转。重启应用确认多排和颜色保留；真实本地音频显示多排歌词，见 `build/menu-qa/interaction-results.json`、`multiple-pink-persisted.png`。
- 300 秒本地 PCM 音频的三次暂停跳转：实际媒体会话位置分别约 73.874、211.917、27.690 秒；对应歌词为 70、210、20 秒行。恢复后继续前进；双轴旋转保留角度，音频分析读取到非零 PCM 能量。证据见 `build/playback-fix-qa/results.json`、`native-audio.log`。本次不是用 UI 请求值代替实际播放位置。
- 工程检查：完整 TypeScript、ESLint、53 项 JS 测试，Debug／Release 各 35 项 Android 单元测试。五架构签名 Release 构建及签名／ZIP 对齐检查；证书与 v1.1.0 相同。
- 补充验证：1 分钟自定义定时到期，实际媒体会话移除、进程退出，日志为 `Handle Exit App, Reason: Timeout Exit`；勾选播完当前歌曲时，到期进入等待当前歌曲结束状态。
- [GitHub 发布构建](https://github.com/margaretbriggs18101985rgu-crypto/music-plus/actions/runs/39055356069) 成功，五个 APK 与校验文件已公开发布；下载发布页通用包再次验证 SHA-256、原签名、版本及 ZIP 对齐。可随源码查看的结果：[v1.1.1-results.json](doc/qa/v1.1.1-results.json)。
- 限制：无声模拟器验证解码、媒体会话与交互；未宣称通过真机听感、长时性能／功耗、完整 TalkBack、所有第三方在线音源或蓝牙验收。

final result: passed

## 2026-10-18 沉浸式双布局、星空与字体

- 依据本次用户提供的星空、分栏黑胶、全屏歌词和透明控制栏截图实施。研究了 GitHub Mineradio-paused 的星流与歌词表现，Android 绘制和交互独立实现，未复制其 GPL 源码或素材。
- 黑胶＋歌词：横屏左右分栏、竖屏上下排列；全屏歌词：无唱片且保持舞台中心。两种布局均保留星空。控制栏透明，播放键对称居中，空白处隐藏、轻点舞台恢复；右上角明确提供“唱片／歌词”双向切换。
- 星空改为冷色细星点、曲线星带、缓慢三维视角，批量绘制并复用坐标数组，移除尾线、流星、模糊和上一帧叠加。多排歌词按真实高度连续定位，单句采用固定舞台与克制的景深过渡。
- 四种字体：默认、霞鹜文楷 Lite、站酷小薇、站酷庆科黄油体。设置卡片直接显示真实字体；选择即时应用并持久化，测量和显示使用同一字体。原始 TTF、完整 OFL 版权授权和来源校验清单随 APK 分发。小薇未覆盖的繁体字回退系统字体。压缩后的字体数据约 14.46 MiB，是本次安装包增量的主要来源。
- 验收发现并修复：菜单切换子面板继承旧滚动位置、首次字体选项被遮住；原生用户音源共享事件被首个订阅者修改，后续订阅者重复 JSON 解析；启动恢复旧歌曲的异步歌词／封面回写新歌。最后一项在真实界面先观察到串歌，再通过当前选择身份校验修复，新增延迟成功、失败、同 id 重选和正常恢复的回归测试。
- 工程验证：TypeScript、完整 ESLint、63 项 JS 测试通过；Debug／Release 各 38 项 Android 单元测试通过。全部四 ABI 和通用 APK 构建成功。最终 Release JS 源映射确认包含恢复竞态修复。
- 原生 UI 场景检查：横竖屏两种布局、真实按钮往返、唱片点击进入、首尾歌词、快速切句、减少动画、控制栏对称、按钮不触发隐藏、隐藏前后当前歌词坐标一致。字体菜单四项均逐一点击，重启后霞鹜文楷仍选中；真实横屏标题顶部为 96px，避开 74px 系统状态栏。
- 真实播放检查：本地 180 秒 PCM WAV 与同名 LRC。点选进度后媒体会话记录位置 108.522 秒，界面确实显示对应的“Audio sync 108 seconds”；拖动后位置 134.110 秒；旋转与切换布局后恢复播放至 136.630 秒。这里通过短暂恢复／暂停使媒体会话发布实际解码位置，不把进度请求值当作播放结果。真实播放器的隐藏／恢复与进度触摸隔离均通过。
- 签名通用候选包：45,283,853 字节，SHA-256 `f48ad2befdd091c5e3c6e2d7213f813450cc64105fd52767fd6ba8cf01d14717`。签名证书与已发布 v1.1.1 APK 一致，ZIP 对齐通过。保留版本 1.1.1／versionCode 3，没有发布新的 GitHub 版本。
- 可随源码审阅的截图与说明见 [PLAYER_LAYOUTS.md](doc/PLAYER_LAYOUTS.md)；汇总证据见 [immersive-player-results.json](doc/qa/immersive-player-results.json)。完整本地截图、录屏、日志在 `build/motion-qa/`。
- 限制：交互测试使用 headless Android 模拟器上的 standalone Debug，Release 完成构建、字体文件／授权完整性、签名及对齐验证；没有冒充真机听感、功耗或稳定 60fps 验收。本次带录屏的模拟器样本 692 帧，p50 29ms、p90 40ms，按 frame-deadline 口径 6.79% 延迟帧，不能外推到手机。

final result: passed within the stated emulator and build scope

## 2026-10-18 控制栏透明样式修正

- 按用户反馈移除横竖屏控制区域的胶囊边框及整体点击时的面板涟漪；容器不绘制底色、描边或阴影。竖屏使用原来的歌手与操作行、带时间标签的进度条、五键播放比例，移除重复封面／标题卡片。横屏沿用横向对称排列。
- 更新歌词底部避让高度以匹配原竖屏控制区域。控制区域隐藏前后，当前歌词坐标保持一致。
- Debug／Release 四 ABI 与通用包构建通过。模拟器分别检查横竖屏下黑胶与全屏歌词四种页面状态，播放键居中、操作按钮不会触发隐藏、空白处隐藏及点击舞台恢复均通过；实际截图已更新到 `doc/ui/immersive-*.png`，本地证据 `build/transparent-controls-qa/`。
- 最终通用签名候选包 45,283,609 字节，SHA-256 `a1b631a8caeea8b96848cf0ae84b54c1608f0b6c08ffa7943486a89d3bde31fe`，与已发布包证书相同，ZIP 对齐及三款字体文件／授权完整性通过。候选包已覆盖更新 `build/apk/music-plus-v1.1.1-immersive-universal.apk`。

final result: passed within the stated emulator and build scope
