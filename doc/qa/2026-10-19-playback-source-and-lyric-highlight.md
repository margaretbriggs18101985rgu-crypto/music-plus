# 播放恢复、播放器手动换源与歌词高光

日期：2026-10-19。基于本地 1.1.6，未修改发布版本号或在线更新信息。

## 改动与依据

- 原播放流程在获取 URL 失败时会换源，但拿到 URL 后实际音频加载失败，只会再次刷新原来源。现在按当前播放选择记录失败平台和坏链接：每个平台至多刷新一次，重复坏链接直接跳过，使用已有 LX 歌曲匹配尝试其他来源。URL 请求超时 12 秒，找不到可用源时按原策略提示失败并准备下一首。
- 获取 URL 的状态标记在提交 native track 前释放，让 Connecting/Playing 事件正常到达。Connecting 与 Buffering 超时均可触发恢复；原来的 `isPlay` 条件不能覆盖尚未播出的歌曲。异步请求和读取进度均检查当前播放选择，旧结果不能覆盖新歌。
- 播放器更多菜单在“切换音质”下加入“手动换源”，复用原有平台搜索选择面板。选择候选时不插入临时队列；确认后保存 `toggleMusicInfo`，保留当前歌曲条目、歌单顺序与确认的播放位置。重新打开清空旧选择，搜索结果有请求版本隔离。
- 原歌词使用整块文字的横向渐变，导致所有换行共用一个横坐标。现在根据 Compose 实际换行与字形边界绘制白色高光，完成的上一行保持高亮，再推进下一行。
- QRC/KRC/YRC 已由现有音源归一化为 LX `<相对开始毫秒,持续毫秒>`，现在将这些数据匹配到同一时间、相同正文的显示行，传到 native。逐字时间保留停顿和持续时间，并处理歌词 offset；正文不匹配或时间非法时不套用其他版本的数据。
- 显示在播放器确认的位置之间做线性插值，支持倍速；650 毫秒没有新采样后停止外推。暂停、缓冲、确认后的 Seek 重新锚定。逐帧状态仅在绘制阶段读取。

先检索的开源参考：[LX Music Mobile](https://github.com/lyswhut/lx-music-mobile)、[LX 社区分支的失败换源工作](https://github.com/0LuckyStone0/lxwalnut-music-mobile)、[AMLL 的逐字时间模型](https://github.com/amll-dev/applemusic-like-lyrics/blob/main/packages/docs/src/content/docs/en/guides/lyric/ttml.md)。复用现有 LX 匹配和 Android 文本布局，没有新增播放器依赖。

## 验证

- `npm run lint`、`npm run typecheck` 通过。
- `npm test`：191/191 通过，含 16 个播放恢复/手动换源场景和 5 个逐字时间解析场景。
- `:app:testDebugUnitTest`、`:app:testReleaseUnitTest`：各 58/58 通过，含真实逐字时间、演唱停顿、插值上限和暂停/倍速检查。
- 独立 Debug APK（x86_64）构建、覆盖安装到 API 37 模拟器并启动通过。
- 正式四 ABI `:app:assembleRelease` 构建通过；通用包包含 arm64-v8a、armeabi-v7a、x86、x86_64，未开启 debuggable。签名校验通过，证书与原 1.1.6 包一致。
- `tools/test-lyric-highlight.py` 对真实 Compose 组件截图做像素断言：0%、25%、50%、75%、90%、100% 高光按阅读顺序推进；第二行在第一行完成之前保持未亮；完成部分不回退；暂停在 50% 重复刷新时像素完全一致。
- 像素证据：25% 时两行白色像素为 `[16187, 0]`；90% 为 `[50793, 5125]`；100% 为 `[50793, 11944]`。完整结果在 [`results.json`](../../build/lyric-highlight-qa/results.json)，截图均明确标注“界面测试 · 无音频”。
- 主应用实测“更多播放设置 → 手动换源”：入口可见，搜索显示五个平台和候选。选择候选后 native session 仍暂停；确认从原 WY 条目指定 KW 同版本后，native session 进入 PLAYING，UI 实际位置推进到 `01:25 / 03:16`，歌名和条目保留。该测试没有验证可听声音。菜单截图：[`player-source-entry.png`](../../build/lyric-highlight-qa/player-source-entry.png)。

## 本地修复包

沿用内部版本 1.1.6/versionCode 8，仅作为本地修复包，尚未发布到 GitHub。继续使用与原安装相同的 APK 架构；不同架构的 versionCode 不可直接混用。所有包及 `SHA256SUMS.txt` 在 `build/fixes/2026-10-19-playback-lyrics/`，旧 `build/apk/` 下的已发布包没有覆盖。

- [通用 APK](../../build/fixes/2026-10-19-playback-lyrics/music-plus-v1.1.6-playback-lyrics-fix-universal.apk)
- [ARM64 APK](../../build/fixes/2026-10-19-playback-lyrics/music-plus-v1.1.6-playback-lyrics-fix-arm64-v8a.apk)
- [校验文件](../../build/fixes/2026-10-19-playback-lyrics/SHA256SUMS.txt)

## 验证边界

普通 LRC 只有整句时间，逐字高光仍按句内时长估算；不能从整句时间推断精确的每字演唱时刻。有真实逐字数据时才按其时间推进。截图 fixture 证明布局和绘制顺序，不证明音频同步。没有连接用户真机，未验证《半岛铁盒》这条具体记录的音源内容、逐字数据、听感和长时间后台行为，也不保证所有平台或歌曲始终可用。
