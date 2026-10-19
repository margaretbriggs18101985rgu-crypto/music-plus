# MUSIC++ — 沉浸式空间歌词播放器开发实施文档

> **交付对象：Codex（直接在现有 MUSIC++ 项目中开发）**
> 文档版本：1.0 · 2026-10-17
> 代码审阅基线：`margaretbriggs18101985rgu-crypto/music-plus`，`main`，提交 `814ae0d845b39e0a92876087150e8d522d2b4301`。**实施前先核对本地 HEAD、工作区及相关文件；代码如已变化，以实际代码为准，不强行覆盖。**
> 附带参考图：`user_reference_scene.jpg`；该图为用户提供的视觉氛围参考，不是可直接复用的完整手机 UI，画面中拍摄环境、第三方图标、视频字幕均不是产品需求。

---

## 0. Codex 执行指令（先读）

你是本仓库的 Android / React Native 开发者。本任务是**在已运行的 Android 原生黑胶播放器上增加「沉浸式空间歌词」及音乐氛围视觉系统**，而不是重写音乐软件、创建第二套播放器或只生成效果图。目标是：酷炫但克制、歌词清晰可读、手势真实跟手、具备可验证的播放联动和性能降级。

**先做基线审计并列出拟修改文件与验收计划，然后分阶段实现、逐阶段运行测试。**不要为赶效果把所有动效堆在一个 `PlayerScreen.kt`，不要删除原有功能、忽略既有 UI 契约、采用虚假按钮/模拟音频/假的歌词同步结果，也不要直接发布正式 Release。原则上在独立工作分支实施，保留旧实现、可回滚，使用小粒度提交。

交付必须包含：可运行源码、必要单元测试、Android 真机/模拟器验证证据、动效参数说明、前后对照截图/短录屏、未覆盖项和回滚办法。**如果本地环境不能构建/不能运行设备，要明示未验证，不能只用浏览器预览或代码静态检查宣称完成。**

## 1. 产品定位与用户需求

MUSIC++ 的底层继续保留 LX Music 的多音源、搜索、歌单、收藏、下载、播放和同步能力；本任务只优化 **Android 竖屏播放详情界面**。

参考画面体现的是「大型发光文字居中、极暗的舞台背景、氛围粒子/光斑、底部轻量化控制栏、强烈空间层次」，不是把每个按钮都做成霓虹，也不是复制参考视频字幕。

### 1.1 目标体验

- 默认仍可使用已有黑胶模式；点击唱片或现有顶部曲名切入**沉浸式歌词模式**，能顺畅返回黑胶模式。
- 沉浸模式主角是正在播放的**真实歌词**：当前句大字、柔光、出现/切句时轻微弹性「跳动」；前后句弱化，有深度与景深效果；真实时间点切换。
- 背景是**封面色系的深色动态渐变 + 柔光 + 少量粒子**，音乐播放时活跃，暂停/缓冲时静止或弱化；背景不得干扰阅读。
- 手指**左右拖动歌词舞台，文字立即跟手平移，并出现有限的 3D 水平透视倾斜**；远景背景和粒子以不同位移幅度移动，形成视差。松手后平滑回正。
- 手指**上下滑动，正常浏览历史/未来歌词**；保留点击某句 Seek，避免将纵向滚动错误识别成相机转动。以后可在「自由视角」独立手势下增加俯仰视角。
- 底部保留真实进度、播放/暂停、上一首/下一首、模式切换、队列、歌曲信息/下载以及当前页已有收藏/评论、歌手跳转等功能，不得产生任何功能回退。
- 没歌词、没歌曲、没封面、长文本、缓冲、切歌、后台恢复、屏幕缩放、无障碍和低性能设备均正常。

### 1.2 不在本轮范围

- 不改写/新增音乐音源解析、付费权限或播放服务。
- 不开发一套新的音频播放器、不用视频/GIF 替代真实动画。
- 不承诺基于真实音频频谱的实时节拍特效；若暂不接 PCM/FFT，视觉起伏只能命名为**播放状态驱动的氛围动画**，不能伪称实时声学数据。
- 不把纯 LRC 按行时间戳伪装成准确的逐字卡拉 OK 时间戳；逐字歌词作为后续增强。
- 不在本任务同时做全应用 UI 改版、主题重构或 Windows 客户端。

## 2. 仓库现状与必须复用的代码

以下为审阅提交中的事实，Codex 在实际改动前再次核对：

| 路径 | 现状 / 正确处理 |
|---|---|
| `android/app/src/main/java/cn/toside/music/mobile/vinyl/PlayerScreen.kt` | 现有 `state.lyricsVisible` 在黑胶与歌词之间切换；保留主要布局结构和安全区处理，在其中**组合新视觉组件**。 |
| `.../vinyl/PlayerLyrics.kt` | 现有 `LazyColumn`、按 `activeLyric` 跟随、边缘遮罩、点击歌词 Seek；在其基础上演进，不丢失滚动与点击能力。 |
| `.../vinyl/VinylPlayerState.kt` | 播放状态、歌词列表、时间/进度、封面、收藏、播放模式等真实状态；视觉新增字段要有默认值且兼容 Debug 演示。 |
| `.../vinyl/VinylPlayerView.kt` | RN → Compose `playerState` props 解析，Compose → RN `onPlayerAction` 事件桥；增量扩展，保持当前 action 名称和单位。 |
| `src/screens/PlayDetail/Vertical/VinylPlayer.tsx` | 从 TrackPlayer/真实播放进度、`useLrcSet()` / `useLrcPlay()` 推送歌词；`lyricsVisible` 已存在；视觉设置如需持久化在这里从原设置层传入。 |
| `.../vinyl/VinylRecord.kt`、`VinylRotationClock.kt`、`Tonearm.kt` | 现有唱片纹理、真实旋转状态、唱臂动画；**原逻辑不可退化**，特效与旋转角度分离。 |
| `.../vinyl/PlaybackProgress.kt` | 真实 Seek 与拖动预览；禁止在进度条区域接管舞台手势。 |
| `.../vinyl/PlaybackControls.kt`、`PlayerNavigation.kt`、`SongInfo.kt` | 保留所有真实操作、按钮语义、功能入口。 |
| `src/plugins/lyric.ts` | 原有歌词数据入口；先检查实际数据模型，再决定逐字数据支持，不自造字段。 |
| `android/app/src/test/java/cn/toside/music/mobile/vinyl/VinylRotationClockTest.kt` | 既有单元测试，不得删除；新增视觉/手势纯逻辑单测。 |
| `doc/CURRENT_UI.md`、`doc/VINYL_PLAYER.md`、`design-qa.md` | 需在实施完成后更新，记录真实验收边界。 |

技术约束：React Native 0.73.11、Kotlin 1.9.24、Compose 1.7.8、Compose Compiler 1.5.14、Coil 2.6.0，现有 Android 构建工具链见 `doc/ANDROID_BUILD.md`。**禁止为了特效而无审批整体升级 Kotlin、RN、Media3、Gradle，或无验证引入大型 3D/粒子引擎。**优先使用 Compose `Canvas`、`graphicsLayer`、`Animatable`、`Transition`、`Brush`，以及项目现有 Coil 图像管线。

### 2.1 目前歌词行为要特别保护

- `PlayerLyrics.kt` 通过 `state.activeLyric` 跟随当前句，点击行时调用 `onAction("seek", line.time / 1000.0)`。注意：**歌词原始 `time` 为毫秒，播放器 Seek 接收秒**。
- `VinylPlayer.tsx` 目前向原生发送 `{ time, text, translation }`，以及 `activeLyric`、`isPlaying`、`position`、`duration`。不能凭空要求原生获取音频 PCM 或逐字时间戳。
- 播放器的 RN 事件源和 Media3/TrackPlayer 是唯一的音频真相。**不能给 RN↔Compose 桥每帧发送动画属性**；每帧动画完全在 Android 原生组件内部驱动。
- `topInset` / `bottomInset` 在 `VinylPlayerView.kt` 根据实际窗口位置校正，不能直接重复施加状态栏/导航栏 padding。

## 3. 页面结构与图层方案

推荐用单个 `Box(fillMaxSize())` 做背景容器，再将内容叠放在前景；原有底部交互栏仍走正常可测布局，不要把固定控件置于不可点击的透明蒙层后。

```text
PlayerScreen / Root Box
├── [Z0] ImmersiveAmbientBackground   封面色调渐变、暗色遮罩、缓慢移动光斑
├── [Z1] ImmersiveParticleLayer       少量前后景粒子（只负责视觉，pointerInput 不拦触摸）
└── [Z2] Main Column（复用窗口安全区）
    ├── PlayerTopNavigation         返回 + 曲目（保留原有效操作）
    ├── VisualStage [weight(1f)]
    │   ├── VINYL：现有 VinylRecord + Tonearm + SongInfo
    │   └── IMMERSIVE_LYRICS：3D 歌词舞台 / 跟手 / 高亮 / 翻译
    ├── [歌词模式已有] ArtistLink + 收藏 + 评论
    ├── PlaybackProgress            真实进度、seek；固定在舞台外
    ├── PlaybackControls            真实上下首等；固定在舞台外
    └── PlayerViewSwitch             歌曲信息与下载；固定在舞台外
```

为了避免黑胶模式变得花哨过度，可以给两种模式不同的视觉强度：

| 属性 | 黑胶模式 | 沉浸歌词模式 |
|---|---|---|
| 背景 | 柔和动态渐变、低粒子密度 | 深色渐变、空间光斑、较丰富但克制的粒子 |
| 主视觉 | 既有黑胶与唱臂，不改变 12 秒/圈真实状态规则 | 当前歌词为唯一视觉焦点 |
| 歌词 | 可选择只在现有区域显示当前句预览；不挤压唱片 | 大字、前后句透视弱化、点击跳转 |
| 手势 | 点击唱片切歌词，唱片旋转不受拖动状态影响 | 横向跟手+倾斜，纵向滚动歌词 |
| 底部 | 原有控件 | 同一套控件，适当做低对比半透明视觉包裹 |

## 4. 视觉规范（作为初始参数，不是不可修改的魔法数字）

### 4.1 背景和色彩

1. 从**已成功获取的封面位图**中取代表色；做亮度、饱和度与对比度约束，把颜色变成深色背景渐变，不直接把鲜艳封面图全屏铺满。
2. 颜色提取放在后台/图像加载回调，**只在 `trackId` 或图片实际改变时重新提取**，不是每帧提取。复用 Coil 缓存或既有图像请求及 User-Agent，避免重复网络请求。
3. 颜色更新 500–900ms 柔和过渡；封面不可用时回退到 `VinylPalette` 的安全深色方案（当前 Top/Middle/Bottom）。
4. 粒子颜色从封面低饱和强调色派生；正文始终维持足够对比度，暗色遮罩强度优先服务歌词可读性。
5. 4–6 个低透明度柔光团缓慢漂移即可；避免所有粒子/背景都依赖全屏实时 Gaussian Blur，多用预渲染渐变与透明叠加。

### 4.2 粒子背景

- 建议 20–45 个低亮度小粒子 + 4–8 个大而暗的模糊光点，必须可根据性能档位降低。
- 分两至三层：远景移动约 0.15×舞台横向拖动位移，中景 0.30×，近景 0.45×；歌词本体位移可为约 0.85×，形成可见视差。
- 粒子缓慢漂移、轻微闪烁，不允许闪屏、快速频闪和过高对比，不能遮盖歌词/控件。
- 无音频播放时允许极慢的环境呼吸，但不能表现为真实节拍；暂停时主发光节奏淡出，进入后台时停止逐帧更新。
- 可采用 Compose `Canvas` 单层渲染，粒子属性在创建阶段稳定生成，动画只更新小型时间参数，避免每帧创建随机列表与大批对象。

### 4.3 歌词排版与光效

- 当前句默认约 **30–42sp** 的自适应范围：中等宽度约 36sp 起；320dp 窄屏、系统放大字体、超长中文/英文歌词时自动缩小/换行，**不截断歌词内容**。
- 当前行可用 `FontWeight.SemiBold`；非当前行约 18–24sp，透明度 0.25–0.55；译文约 14–18sp，采用明确的第二视觉层级。
- 当前句保持相对中心位置；前后 1–3 行可见，越远越淡、略缩小/后移；超长歌曲仍需虚拟化渲染，不在整首歌词上创建过多独立发光层。
- Glow 为**柔和边缘辉光**，不是粗壮白色阴影。建议文本主色白/浅色 + 单个轻量柔光底层；高对比图片下通过暗色遮罩保证可读性。
- 新句进入：280–420ms 的轻弹性 `scale 0.96 → 1.035 → 1.0`，伴随 8–16dp 轻微上浮和短暂 Glow 增强；不是每秒整句乱跳。若过长文字换行，应保持行组整体稳定。
- 若源数据只提供逐行 LRC，不应以随机/平均字符速度宣称真实逐字同步；可在后续独立引入精准逐字时间戳和对应单词/字符高亮。

### 4.4 切歌与模式切换

- 黑胶 → 歌词：视觉舞台交叉淡入淡出 240–360ms，不能中断实际播放，不能重置黑胶 `VinylRotationClock`。
- 切歌：当前歌词和封面光晕快速柔和退场，新封面色渐变平滑接替，加载失败使用稳定暗色兜底；不要让旧歌词滞留显示在新歌上。
- 暂停/缓冲：舞台动态视觉减弱（或按设置冻结），恢复继续。页面切回前台不突然补播累积的动画时间。

## 5. 歌词跟手与空间视角交互（核心验收项）

> 重要：图片只能证明大字发光歌词的视觉风格，**「滑动跟手并改变视角」来自用户明确要求**。实现必须是真正由触摸位置驱动，而非单纯固定左右切换动画。

### 5.1 默认手势映射（第一版必须完成）

| 交互 | 预期行为 | 冲突处理 |
|---|---|---|
| 横向单指拖动歌词舞台 | 立即更新 `translationX` 和 `rotationY`；粒子/光斑较小幅移动；手指在哪里，视角就到哪里 | 使用触摸 `touchSlop` 后锁定横向，不与 `LazyColumn` 纵向滚动争抢 |
| 松开横向拖动 | `spring` 平滑回到正视；惯性轻微，最长不应拖泥带水 | 被取消/触摸中断也必须回正 |
| 纵向单指滑动 | 正常滚动歌词，允许查看前后句 | `LazyColumn` 优先处理纵向方向，不能由外层消耗纵向事件 |
| 单击歌词行 | 通过原有 `seek` action 跳至该行 | 必须区分拖动与点击；拖动结束不能误触 Seek |
| 点击唱片或顶部曲名 | 在黑胶/歌词模式之间切换 | 不变更歌曲/队列/播放状态 |
| 拖动底部进度条 | 真实预览进度，松手 Seek | 该区域不响应歌词视角手势 |
| 返回 / 系统返回 | 按既有导航行为退出播放页 | 不得因手势捕获导致失效 |

建议初始数值（按实际屏幕测试调参）：

```text
dragPx                 = 当前已锁定横向的累计手指位移，限制在 ±(舞台宽度 * 0.28)
normalizedX             = clamp(dragPx / (舞台宽度 * 0.25), -1, 1)
lyricTranslationX       = clamp(dragPx * 0.85, -72dp, +72dp)
yawRotationY            = normalizedX * 9°   （初始范围 ±9°，上限不超过 ±12°）
backgroundParallaxX     = dragPx * 0.15
midParticleParallaxX    = dragPx * 0.30
foregroundParallaxX     = dragPx * 0.45
cameraDistance          = 按像素单位与舞台宽度校准，足够远以避免夸张透视
release                 = spring 回至 0；建议约 280–450ms 内视觉基本稳定
```

原则：跟手阶段禁止再套高延迟 `animate*AsState` 平滑，否则用户会感到明显滞后；**按 PointerInput 直接更新视图状态，只有释放后才执行 spring**。所有位移需限定，禁止旋转到歌词不可读的角度。

**实现推荐**：在 `ImmersiveLyricStage` 的歌词容器设置水平方向手势检测（如 `detectHorizontalDragGestures` 或精确处理 touch-slop 的自定义逻辑），通过 `graphicsLayer { translationX; rotationY; cameraDistance }` 控制渲染；保留内部 `LazyColumn` 的垂直滚动和单行点击。在常见设备上验证父子 PointerInput 与嵌套滚动事件传播，不能仅静态代码审阅推定无冲突。`rotationY` 依赖实际 `graphicsLayer` 的透视效果；无须引入 3D 引擎。

### 5.2 可选增强（第二阶段，不阻塞 V1）

- 双指拖动舞台可解锁 `rotationX`（俯仰，±4–6°）+ `rotationY`，实现不同俯视角；单指纵向仍只滚动歌词。
- 可增加「视角锁定」开关/左、中、右三个预设，但**第一版不默认保持倾斜**，松手应回正以保证歌词可读。
- 只有在无障碍可用且滑动与滚动不冲突时引入轻微设备倾斜视差；默认关闭，给用户明确开关。

### 5.3 歌词自动跟随策略

- 默认正常随真实 `activeLyric` 变化将正在唱的句子带回舞台视觉重心。
- 用户手动上下滚动时，**立刻暂停自动跟随**，避免视图和手指互相争抢；可选择在静止 3–5 秒后恢复，或出现「回到当前歌词」按钮，由 Codex 根据既有 UI 做更自然实现。
- 横向视角拖动不改变 `activeLyric`、播放进度或滚动到的歌词索引。
- 发生真实 Seek / 换歌时，及时重新定位当前歌词并清理旧歌手势状态；滚动中不能突然跳旧曲索引。
- 同一首歌仅因每秒时间/播放状态刷新，不应重复重建整套歌词或重置用户手动浏览位置。

## 6. 状态模型、生命周期和桥接

### 6.1 优先最小扩展

现有 `lyricsVisible` 已能满足基础双模式，V1 **不必为了命名再增加互相冲突的两个模式字段**。内部可封装 `VisualMode = VINYL / IMMERSIVE_LYRICS` 但应只以现有布尔状态为单一事实来源。未来若增加第三种封面/视觉模式，再统一重构为枚举。

原生 `VinylPlayerState` 可考虑新增有默认值的 `visualEffectsEnabled`、`reduceMotion`、`particleLevel` 等字段，且同步更新 RN `NativePlayerProps` 与 `VinylPlayerView.updatePlayer()`；具体字段先审计现有设置类型与默认值机制。

推荐初始设置：

```text
immersiveVisualsEnabled  = true        // 用户可以关闭沉浸特效，但保留歌词页面
particleQuality         = auto        // auto / low / high / off
lyricMotionEnabled      = true        // 关闭后保持高亮与滚动，移除弹跳/透视
backgroundMotion        = true        // 关闭后为静态深色渐变
respectReducedMotion    = true        // 尊重系统减少动画/动画关闭选项
```

如现有 setting schema 不支持这些字段，按项目规定添加持久化、默认值和迁移，不要只做 UI 假开关。第一阶段允许把参数放在内部 `ImmersiveVisualConfig.kt`，先实现可测试的开关与自动降级，第二阶段再把设置入口接到现有设置页。

### 6.2 唯一音频和歌词来源

- `isPlaying` 必须继续来自真实 `State.Playing`，缓冲/连接不能当作正在播放。
- 歌词 `lyrics` 和 `activeLyric` 必须来自原有歌词解析/播放管线；不额外请求第三方歌词接口，也不在原生端自建播放计时器替代播放器位置。
- 轻量环境动画可以在没有声学数据时运转，但**不能称为实时频谱/节拍响应**；若后续引入真实 FFT，另行评估 TrackPlayer/Media3 回调与设备兼容。
- 不把封面解码后的大 Bitmap、颜色数组或动画帧持续通过 JS bridge 发送；优先在 Android 本地获取并缓存。
- 状态变化只响应所需字段：封面变化触发取色、当前句变化触发弹入、播放状态变化控制动画，播放秒数变化仅更新进度/歌词状态。

### 6.3 生命周期与缓存

- 视图前后台：使用与 `VinylRecord.kt` 相同级别的 Lifecycle/`LocalLifecycleOwner` 观测；`RESUMED` 时驱动动画，非前台停止高频帧循环。
- 切模式不重启音频；返回黑胶时保持既有旋转记忆，进度、收藏与播放队列完全不变。
- 切歌/图片失败：取消过时的取色任务，避免旧封面异步完成后覆盖新背景。
- 组件 Dispose / 页面离开：取消 Coroutine/帧循环/图片回调，不泄露 `Activity`、`View`、`Bitmap`。
- 应用从后台恢复：用当前视觉时间重建动画基准，避免长时间休眠后粒子瞬移或动画跳跃。

## 7. 推荐文件拆分（建议，不必僵化照抄）

保留现有文件及功能，在原生目录 `android/app/src/main/java/cn/toside/music/mobile/vinyl/` 新增：

| 文件名 | 职责 |
|---|---|
| `ImmersiveLyricStage.kt` | 歌词沉浸模式容器、舞台布局、前后景歌词、顶层点击与视觉组合；重用 `PlayerLyrics` 的同步/Seek 逻辑。 |
| `LyricPerspectiveController.kt` | 纯函数：归一化拖动、横向偏移、yaw、视差幅度、边界裁剪；独立单测。 |
| `LyricMotion.kt` | 歌词切句 spring/高亮/缩放/发光、减少动画策略。 |
| `AmbientBackground.kt` | 封面配色的安全深色背景、渐变、光晕、切歌色彩过渡。 |
| `AmbientParticles.kt` | Canvas 粒子渲染与可复现粒子参数；按模式/性能/前后台控制。 |
| `ImmersiveVisualConfig.kt` | 参数集、动画档位、性能/无障碍降级开关（如必要）。 |

必要的现有文件修改：

1. `PlayerScreen.kt`：在背景叠放 Ambient 层，在 `state.lyricsVisible` 分支接入 `ImmersiveLyricStage`；既有控制布局尽可能复用。
2. `PlayerLyrics.kt`：抽取或重用列表渲染与歌词自动跟随逻辑。**不要把同一份歌词渲染两遍造成视觉重影和多次点击事件**。
3. `VinylPlayerState.kt`、`VinylPlayerView.kt`：仅在确实需要配置状态时新增受控字段；兼容旧字段、默认值。
4. `src/screens/PlayDetail/Vertical/VinylPlayer.tsx`：仅在视觉配置需要落地时修改 `playerState`；绝不构造第二个虚拟 audio player。
5. 现有设置相关文件：当产品设置持久化实现时，沿用现有设置设计；不添加无效开关。
6. `doc/VINYL_PLAYER.md`、`doc/CURRENT_UI.md`、`design-qa.md`：更新功能、截图、测试结果及限制。
7. `android/app/src/test/.../LyricPerspectiveControllerTest.kt` 等：新增纯单元测试。

> 先查看相关文件的最新内容、原歌词滚动行为和 Kotlin 可见性，再决定抽取方案。上表是建议职责，并非要求固定组件签名。

## 8. 实施批次与停止条件

### P0 — 基线、安全与范围锁定

- [ ] 核对 HEAD、当前 git status，单独创建工作分支，记录基线提交与测试结果。
- [ ] 阅读本文件第 2 节列出的源文件与当前设置默认值，不覆盖用户未提交修改。
- [ ] 运行 `npm run typecheck`、`npm run lint`、`npm test`；条件具备时执行既有 Android 单测与 Debug 构建。
- [ ] 收集当前黑胶页、当前歌词页的同设备截图，记录设备像素密度、fontScale、SDK 版本。

**停止条件**：基线构建本身失败或关键脚本缺失时，先说明原因，区分旧故障与本次改造，不能归咎于新代码。

### P1 — 可用的空间歌词（先保功能，再做华丽）

- [ ] 基于真实 LRC 构建大字歌词舞台，当前句突出、前后句有清晰层级。
- [ ] 实现新句出现时轻量弹性高亮和歌词跟随；长行、换行、译文正常。
- [ ] 实现横向跟手 `translationX + rotationY`、背景简易视差、松手回正。
- [ ] 验证横向倾斜和纵向 `LazyColumn` 滚动互不冲突，行点击 Seek 仍正确。
- [ ] 现有黑胶/歌词切换与所有真实播放控制保持正常。

**P1 验收门槛**：不需要粒子，也要在真实触摸中明显看到「拖动角度变化」，并通过上下滚动、点击 Seek、黑胶返回回归测试。

### P2 — 氛围背景与粒子

- [ ] 封面取色、深色处理、过渡、缺封面回退与旧请求取消。
- [ ] Canvas 低密度粒子和多层视差；效果开启/关闭可复现。
- [ ] 播放、暂停、缓冲、后台、返回前台状态联动。
- [ ] 加入歌词可读性暗色遮罩、对比度及降级策略。

**P2 验收门槛**：不同亮/暗/高饱和封面都不会盖住歌词；无图片时不闪白、不崩溃、不显示上一首配色。

### P3 — 高级抛光与设置

- [ ] 黑胶/歌词切换过渡、切歌动效、按钮轻微反馈。
- [ ] 粒子档位与关闭动画设置（按项目设置架构接入并持久化）。
- [ ] 可选双指自由视角、轻微俯仰；若与滚动冲突，**本轮不要强上**。
- [ ] 无障碍 TalkBack、系统关闭动画、窄屏、大字号及高刷设备实测。
- [ ] 更新截图、短录屏、QA 文档、未覆盖项。

**P3 验收门槛**：默认效果吸引人，但进入节能/减少动画模式后仍是一款完整可用的歌词播放器。

## 9. 测试与验收矩阵

### 9.1 自动测试

至少增加以下断言（使用当前 JUnit 生态，不要求引入新的框架）：

- [ ] 视角映射：`drag = 0` 输出全 0；左右对称；超限 clamp；小屏/零宽不会得到 NaN/Infinity。
- [ ] 视差：背景/中景/前景位移方向正确，幅度不同；`rotationY` 在规定范围。
- [ ] 释放回弹 / cancel 状态清理（能抽出纯状态机的部分进行单测）。
- [ ] 歌词行时间单位一致：`time(ms) / 1000` 转 Seek(s)；越界数据不触发非法 Seek。
- [ ] 空歌词、单句、重复时间戳、长译文、非有限值输入处理。
- [ ] **已有 `VinylRotationClockTest` 必须全部继续通过**。

### 9.2 真机 / 模拟器手工验收

| 场景 | 必须看到/确认的现象 |
|---|---|
| 普通在线曲 + 完整歌词 | 当前句按真实进度变化；文字光效与视角变化肉眼明显。 |
| 左右快速/慢速拖动 | 随手指角度变化，无明显滞后；释放回正、不抖、不闪。 |
| 上下滚动 + 点击历史歌词 | 能正常滚动；点击跳转当前播放器进度，拖动不会误 Seek。 |
| 进度条拖动 | 准确预览/Seek，不被歌词舞台拦截。 |
| 暂停、恢复、缓冲 | 动效状态与真实播放一致，暂停不能假装还在强烈跟随节拍。 |
| 切歌两首不同封面 | 颜色过渡正常，无旧歌歌词/旧封面闪回，播放队列不变。 |
| 歌曲缺歌词、空歌、图片加载错误 | 提示友好、深色兜底、不会崩溃。 |
| 收藏、评论、资料、下载、播放模式、上一首/下一首 | 入口真实可操作，无回归。 |
| 320×640dp 窄屏 + 392×853dp 常见屏 | 主要控制可触达；歌词不超出屏；没有系统栏重叠。 |
| fontScale ≥ 1.3、长歌名、长英文歌词、双语 | 换行合理；主要按钮不遮挡；可手动浏览。 |
| 切后台/锁屏/返回 | 动画暂停/恢复正常，没有转角与背景瞬移或掉电式循环。 |
| 关闭动效/省电档位/TalkBack | 保留清晰歌词、Seek 和播放控制；不发生强制闪烁。 |
| 长时间连续播放（建议至少 30min） | 无明显持续掉帧、发热失控、内存增长。 |

### 9.3 性能目标（应测量，不凭空宣布达成）

- 常见中端 Android 真机，沉浸模式滚动/交互主观顺畅；可设置初始目标为 60Hz 设备大部分帧接近 16.7ms。使用 Android GPU Profile、Perfetto 或 Android Studio profiler 采集数据，而非仅提供视频观感。
- 与改造前比较记录平均帧时间、卡顿帧比例、内存峰值和 10–30 分钟发热/耗电趋势；无基线时如实说明。
- 粒子/光斑必须按性能档位减少，前台不可见时停止高频循环；关键播放组件不卡顿为最高优先级。
- 优先减少无必要全屏模糊、每帧 Bitmap 创建、重构整个 Compose UI 和高频 JS bridge 通信。

## 10. 运行与验证命令

从仓库根目录执行；首先对照实际 `package.json` 和本机工具链。以下命令按当前仓库文档给出：

```powershell
# Windows PowerShell / 仓库根目录
node --version
java -version
npm ci --no-audit --no-fund  # 仅首次或依赖变化时；不要随意更新 lockfile
npm run typecheck
npm run lint
npm test
npm run pack:android:debug

# 或直接测试原生单元测试（Windows）
cd android
.\gradlew.bat :app:testDebugUnitTest --console=plain --max-workers=2
```

Android 安装验证：

```powershell
adb devices -l
# 用实际构建产生的 APK 路径；不要假设版本号没变
adb install -r .\build\apk\<实际生成的debug-apk文件名>.apk
```

注意：基线仓库 2026-10-17 的一次 GitHub `Android release` workflow 在 `android-actions/setup-android@v3` 的 `sdkmanager tools` 报 `Failed to find package 'tools'`，属于**CI 环境安装步骤问题**，与 UI 动效本身无直接因果。已有 `Run build test` 成功及 v1.0.0 Release 文件，但不能因此跳过本次本地 Android 构建和实际设备验证。不要把修复 Release workflow 擅自扩展为本任务提交内容；可单独汇报/开任务。

## 11. 提交、文档和最终汇报格式

完成后请提供：

1. **实现摘要**：用户实际能看到哪些新效果，手势如何操作，哪些属于可选项。
2. **修改文件清单**：每个文件新增/修改内容，说明为何复用/调整现有 `PlayerLyrics`。
3. **质量结果**：原有 typecheck、lint、test、Android debug/unit test 的明确 `PASS/FAIL/NOT RUN`，以及失败日志关键行。
4. **运行证据**：真实 Android 界面的前后截图；短录屏至少覆盖「左右拖动视角→回弹」「上下歌词滚动→点击 Seek」「黑胶↔歌词」「暂停/恢复」「粒子背景」。
5. **性能记录**：采样设备、系统版本、刷新率、效果档位、测量方式、测量结果；没有数据就写未测。
6. **风险与待办**：如逐字歌词、真实 FFT、低端机优化、真机长期后台等，明确哪些未实现，不能将未来规划描述为已完成。
7. **复现方法**：从仓库当前代码构建、安装并进入沉浸歌词模式的步骤。
8. **回滚办法**：提交 hash / 工作分支，确保禁用效果时基础歌词与黑胶仍可用。

### 最终 Definition of Done

- [ ] 真实播放歌曲时，用户能看到大字高亮、切句弹性、动态暗色背景与轻量粒子。
- [ ] 水平滑动时「文字跟手 + 3D 透视 + 背景不同速视差」三者同时成立；不是假的固定动画。
- [ ] 纵向滑动仍能浏览歌词，点按能精确 Seek，不与水平手势冲突。
- [ ] 暂停、缓冲、切歌、后台恢复和黑胶切换不破坏现有播放状态。
- [ ] 收藏、评论、队列、下载、进度与播放控制正常；没有未实现功能按钮。
- [ ] 无歌词/无封面/窄屏/大字号有良好回退。
- [ ] Android 真机或模拟器上实际运行并保留证据；相关单测与构建结果清晰。
- [ ] 性能开关可用，动画可被禁用；核心操作始终优先。

---

## 12. 供 Codex 直接执行的主提示词（复制本段即可）

> 请以本文件《MUSIC++ — 沉浸式空间歌词播放器开发实施文档》为唯一新增需求基线，结合我当前 MUSIC++ 仓库的最新实际源码进行开发。用户参考图为 `user_reference_scene.jpg`，只借鉴大型发光歌词、暗色氛围、悬浮感、底部简洁控制栏，不复制视频字幕与其他 App 的标识。我的核心需求是：**保留现有黑胶模式，在 Android 原生 Compose 歌词页面新增音乐舞台感：大字歌词、当前句轻弹跳、封面调色的动态暗背景、轻量粒子；歌词横向拖动必须实时跟手并发生有限 3D 透视倾斜，背景以较小幅度移动形成视差；纵向依旧滚动歌词，点击行依旧真实 Seek，释放后回弹。**所有歌词与播放状态必须复用原 TrackPlayer/Media3 + RN 状态桥接，绝不造第二套音频、伪歌词或假的实时频谱。先审计本地分支和现有源文件、保护未提交代码，再按 P0→P1→P2→P3 分批开发、编译和验证；功能优先于特效，确保原有播放器操作、黑胶累计旋转、下载/评论/收藏/队列和安全区不回归。请输出实际改动、测试、Android 运行截图/录屏证据和明确未验证事项；遇到构建环境问题单独报告，不要跳过验证或擅自发布。先给出文件级计划，然后执行第一阶段。

## 13. 资料定位

- [项目仓库](https://github.com/margaretbriggs18101985rgu-crypto/music-plus)
- [当前页面说明](https://github.com/margaretbriggs18101985rgu-crypto/music-plus/blob/main/doc/CURRENT_UI.md)
- [黑胶播放器实现说明](https://github.com/margaretbriggs18101985rgu-crypto/music-plus/blob/main/doc/VINYL_PLAYER.md)
- [播放器源码目录](https://github.com/margaretbriggs18101985rgu-crypto/music-plus/tree/main/android/app/src/main/java/cn/toside/music/mobile/vinyl)
- [RN → 原生播放器桥接](https://github.com/margaretbriggs18101985rgu-crypto/music-plus/blob/main/src/screens/PlayDetail/Vertical/VinylPlayer.tsx)
- [Android 构建说明](https://github.com/margaretbriggs18101985rgu-crypto/music-plus/blob/main/doc/ANDROID_BUILD.md)

**文档结束。**
