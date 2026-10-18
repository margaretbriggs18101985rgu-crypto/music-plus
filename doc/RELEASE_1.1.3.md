# MUSIC++ v1.1.3 发布记录

日期：2026-10-19（Asia/Hong_Kong）。版本名 `1.1.3`，基础版本码 `5`；应用标识继续使用 `io.github.musicplus.player`。

## 本版内容

- 可选应用内更新，提供取消／更新／只忽略当前版本，以及设置页手动检查；下载后进行 SHA-256、应用标识、版本码和签名核对，再交给系统确认安装。
- 歌词编辑及重置、收藏歌单自动同步开关、设置与完整数据备份恢复、桌面歌词未播放颜色入口。
- 首次启动直接进入首页，补齐搜索类别与平台入口，修复页面和搜索监听清理。
- 星点独立漂移、明确粒子档位、歌词可视范围及文字律动开关、点击切换歌词／唱片、横屏唱片组居中及按钮比例优化。
- 清理确认未引用的 75 个文件和 5 组重复旧按钮。开源许可证与原作者署名保留。

功能行为、入口和之前的模拟器操作记录见 [功能补全报告](qa/2026-10-19-feature-completion.md)、[播放器优化记录](qa/2026-10-18-player-layout-fixes.md) 和 [应用内更新说明](APP_UPDATES.md)。

## 本地正式构建与校验

- `npm run typecheck`、`npm run lint`、`git diff --check`：通过。
- `npm test`：125 项通过，0 失败。
- `npm run pack:android`：正式构建成功，并通过 40 项 Android Release 单元测试。
- 五种 APK 均通过 `apksigner verify`、`zipalign -c 4` 和 SHA-256 校验，包含 Hermes 字节码、原生库及字体和许可证资源，不启用调试。
- 版本码：universal = 5，armeabi-v7a = 5001，x86 = 5002，arm64-v8a = 5003，x86_64 = 5004。
- 所有包的证书 SHA-256 均为 `f947322e521be51048052578a33143e3f52deec300644f46dec941b2f3965936`，与已发布版本一致。
- 本地构建和验证证据位于忽略的 `build/release-v1.1.3/`，包括测试、构建日志与 `verification-local.json`；正式 APK 及 `SHA256SUMS.txt` 位于 `build/apk/`。

## 安装与验证边界

已有用户应继续使用与原安装相同架构的 APK 覆盖更新；使用通用包的用户继续使用 universal。不同架构版本码区间不同，从分架构包切换到通用包可能被系统判断为降级。

旧 APK 需要先安装本版，才具备新增的前台检查逻辑；应用完全关闭时不发送系统推送。完整备份不包含音乐文件、下载任务、系统目录授权及外部图片，恢复后可能需要重新授权或选择路径。

此前模拟器已验证歌词修改跨重启保存、完整备份导出及恢复闭环、桌面歌词颜色跨重启保存，以及播放器布局和交互。发布时另用公开的 v1.1.2 通用包创建测试歌单，再用公开的 v1.1.3 通用包直接覆盖升级，确认版本码 5、新建歌单保留并正常启动；点击“检查更新”显示当前与最新均为 1.1.3，并读到本版更新说明。自动同步核心和菜单通过隔离测试，未逐个验证音乐平台的真实网络接口；实体手机、长期功耗、蓝牙、人工 TalkBack 和 iOS 构建尚未验收。

## GitHub 发布状态

- 源码提交：`4a956fd232f3c766f8701febc94e9c0047bd5f5d`，标签 `v1.1.3`；源码已同步到 `main` 和 `codex/immersive-lyrics`。
- [源码检查工作流](https://github.com/margaretbriggs18101985rgu-crypto/music-plus/actions/runs/39147561456) 和 [正式发布工作流](https://github.com/margaretbriggs18101985rgu-crypto/music-plus/actions/runs/39147561400) 均成功。
- [v1.1.3 正式 Release](https://github.com/margaretbriggs18101985rgu-crypto/music-plus/releases/tag/v1.1.3) 于 2026-10-19 01:06:54（Asia/Hong_Kong）公开发布，不是草稿或预发布，包含五种 APK 和 `SHA256SUMS.txt`。
- 五种 APK 的 GitHub asset digest 均与实际下载的校验清单一致。已独立下载公开通用包，核对 SHA-256、签名证书、包名、版本码、非调试状态、对齐、Hermes 及原生架构。
- 公开通用包大小为 45,293,645 字节，SHA-256 为 `f5ea5835b94f05cab3a6aa73849c2e287c8f8b990458cadd8d9e52efd581c9c5`。云端和本地构建结果各自独立校验，不要求文件哈希相同。
- 在上述云端资产校验通过后，将 `publish/version.json` 更新到 1.1.3，并保留 1.1.2 及更早的历史记录。
- 云端证据及升级截图保存在忽略的 `build/release-v1.1.3/`：`workflow-status.json`、`release.json`、`verification-cloud.json`、`cloud/`、`upgrade-before.xml`、`upgrade-after.xml`、`upgrade-after.png` 和 `manual-update-check.png`。
