# 更新成功后仍显示旧版本

日期：2026-10-20（Asia/Hong_Kong）；目标版本 v1.1.8，基础 versionCode 10。

## 复现与原因

在 API 37 x86_64 模拟器安装正式签名的 v1.1.7 通用包，Android 报告 `versionName=1.1.7`、`versionCode=9`，应用设置页和更新弹窗却显示 `Current: 1.1.6`，并将线上 v1.1.7 当作新版本。

旧脚本的 Hermes 字符串表包含 1.1.6。旧实现直接从被脚本打包的 `package.json` 获取当前版本；当前安装的 `@react-native/gradle-plugin/src/main/kotlin/com/facebook/react/tasks/BundleHermesCTask.kt` 第 35–45 行仅将 JS、JSX、TS、TSX 纳入 sources，没有跟踪导入 JSON，因此增量构建可能在只改变版本号时复用旧脚本。问题不能靠修改线上版本信息或重复安装同一旧包解决。

## 修复

- `UtilsModule` 从 Android PackageManager 提供已安装版本，以原生 BuildConfig 作为异常回退。应用版本状态、更新弹窗、全局版本及备份统一使用 `appInfo`，仅缺失原生常量的开发环境回退到 package.json。
- Gradle 脚本任务显式跟踪 package.json、package-lock.json 和 src 中的 JSON。任务同时生成内置 `assets/musicplus-build.json`，包含构建版本、基础版本码和 Hermes SHA-256。
- 正式打包逐个检查五种 APK 的包名、原生版本及架构版本码，核对内置构建信息、Hermes 格式和哈希。不一致时停止打包。

## 本地验证

- 类型检查、ESLint、247 项 Node 测试、59 项 Android Release 单元测试通过。
- 实际执行脚本任务后，仅临时将 package.json 版本改为 `1.1.8-cache-probe`，任务重新执行、脚本哈希改变。恢复为 1.1.8 后执行最终正式构建；五个 APK 的内置构建信息均为 1.1.8 / 10。
- 五个 APK 的 SHA-256、签名、ZIP 对齐、包名、版本及 ABI、Hermes、字体与授权文件通过检查。签名与已公开的 v1.1.7 安装包一致。
- 在同一模拟器先安装 v1.1.7 并改变「Show Back to Desktop button」设置，再用 `adb install -r` 覆盖为 v1.1.8。`firstInstallTime` 保留，设置勾选状态保留，系统和设置页均显示 1.1.8。手动检查显示当前版本已是最新（此时远端尚为 1.1.7）。
- 证据及截图位于忽略目录 `build/release-v1.1.8/`；摘要见 `v1.1.8-results.json`。模拟器使用只读临时写入层，不保留对已有 QA 设备数据的修改。

## GitHub 发布验证

- 发布标签：`v1.1.8`，源提交 `e03f58b1fdeaf8e5b2aae613fb1c05322a4dd88e`；GitHub Actions Android Release 运行成功。
- 六个公开附件（五种 APK 和 `SHA256SUMS.txt`）与已发布清单的 SHA-256 一致。独立分段下载的通用 APK 为 46,409,123 字节，SHA-256 `be3b4055ea263fb9047dc8c9b0422a179767a0caca3451a945903a40f288be62`；apksigner 证书与 v1.1.7 公共 APK 相同，基础 versionCode 为 10，ZIP 对齐、Hermes 及脚本构建元数据校验通过。
- GitHub 最新 Release 与 `publish/version.json` 均发布 v1.1.8 后，已对两个公开来源分别执行更新源解析验证。详细结果、下载文件及摘要在忽略目录 `build/release-v1.1.8/`。

真机、厂商锁屏策略、蓝牙和长期功耗不在本次验证范围内。
