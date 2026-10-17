# MUSIC++ v1.1.0 发布记录

日期：2026-10-18（Asia/Hong_Kong）。版本标签 `v1.1.0`，源码提交 `0d235802aa4f3b3edd66e53255fb0061091cc775`。

## 更新内容

- 沉浸式空间歌词、横向跟手透视与回弹、封面取色动态背景和视差粒子。
- 持久化特效设置、减少动画与省电适配，以及黑胶/歌词模式渐变切换。
- 修正发布工作流对 Android SDK 已移除 `tools` 包的依赖，改为显式安装 `platform-tools`。

## 本地正式构建验证

- Node.js 24.22.0、JDK 17，`npm run typecheck`、`npm run lint` 通过。
- `npm test` 42/42 通过；`npm run pack:android` 构建五个正式签名 APK，Android Release 单元测试 31/31 通过，0 failures/errors。
- 五个 APK 均通过 `apksigner verify`、`zipalign -c 4` 和 SHA-256 校验；应用标识为 `io.github.musicplus.player`，版本为 `1.1.0`，不带 `application-debuggable`，内置 JS、Hermes 与许可文件。
- 通用包 versionCode 为 2，分架构包为 2001–2004；上一版相应版本为 1 / 1001–1004。
- 签名证书 SHA-256 为 `f947322e521be51048052578a33143e3f52deec300644f46dec941b2f3965936`，与已发布 v1.0.0 相同。核对旧版本地通用包 SHA-256 与 GitHub v1.0.0 asset digest 一致。
- 本地证据：`build/release-v1.1.0.log`、`build/release-v1.1.0-verification.json`、Android Release JUnit XML。下载文件以 Releases 随附的 `SHA256SUMS.txt` 为准。

## 安装与测试边界

旧版用户请下载与现有安装相同架构的 APK 覆盖更新；上次使用通用包的用户继续使用 `universal.apk`。从分架构包改装通用包可能被 Android 判定为版本降级，请继续使用原架构包，保留应用数据。

P1–P3 模拟器交互证据与限制见 `design-qa.md`、`doc/IMMERSIVE_LYRICS_P1.md`、`doc/IMMERSIVE_LYRICS_P2.md` 和 `doc/IMMERSIVE_LYRICS_P3.md`。本轮没有新增物理真机、人工 TalkBack 或 30 分钟性能/功耗验证；P3 独立行 Seek 复测仍记为未定。

## GitHub 发布

- [主分支 CI](https://github.com/margaretbriggs18101985rgu-crypto/music-plus/actions/runs/39049964988) 通过。
- [Android release](https://github.com/margaretbriggs18101985rgu-crypto/music-plus/actions/runs/39049983608) 通过，包含源码检查、五个 APK 构建、Android Release 单元测试、签名与 ZIP 对齐校验。
- [MUSIC++ v1.1.0](https://github.com/margaretbriggs18101985rgu-crypto/music-plus/releases/tag/v1.1.0) 于 2026-10-18 00:42:50（Asia/Hong_Kong）公开发布，含五种 APK 和 `SHA256SUMS.txt`，不是草稿或预发布版本。
- GitHub 通用包为 30,122,155 字节，SHA-256 `25a8556f7771c22e24667d58039c30326c5916d0f27397374773be10a07cbdc0`；五个 APK 的 GitHub asset digest 均与下载的 `SHA256SUMS.txt` 一致。
- 实际下载 GitHub 通用包并重算 SHA-256，通过 `apksigner verify --print-certs`，签名证书与 v1.0.0 一致。
- 确认附件可下载后更新 `publish/version.json` 到 1.1.0，并保留 1.0.0 更新历史。
