# 原生黑胶播放器视觉与交互验收

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
