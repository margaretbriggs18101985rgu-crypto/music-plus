# MUSIC++ 发布指南

安装包面向 Android，文件扩展名是 `.apk`。签名密钥由项目维护者保管，不能提交到公开仓库。

## 本地正式打包

1. 按 [Android 构建说明](ANDROID_BUILD.md) 安装 Node.js 24.22.0、JDK 17 和 Android SDK。设置 `JAVA_HOME` 与 `ANDROID_HOME`。
2. 创建自己的 Android 签名密钥；同一应用后续更新必须继续使用同一密钥。维护者应离线备份密钥及密码。
3. 在 `android/keystore.properties` 写入以下配置（路径相对于 `android/app/`）：

```properties
storeFile=music-plus-release.keystore
storePassword=YOUR_PRIVATE_STORE_PASSWORD
keyAlias=music-plus
keyPassword=YOUR_PRIVATE_KEY_PASSWORD
```

将密钥放在 `android/app/music-plus-release.keystore`。密钥文件和 `keystore.properties` 已被 `.gitignore` 排除。也可通过 `ORG_GRADLE_PROJECT_MYAPP_UPLOAD_STORE_FILE`、`ORG_GRADLE_PROJECT_MYAPP_UPLOAD_STORE_PASSWORD`、`ORG_GRADLE_PROJECT_MYAPP_UPLOAD_KEY_ALIAS`、`ORG_GRADLE_PROJECT_MYAPP_UPLOAD_KEY_PASSWORD` 环境变量提供签名设置。

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run pack:android
```

命令会构建 Release 并运行 Android Release 单元测试，将五个架构 APK 和 `SHA256SUMS.txt` 放入 `build/apk/`。Release 包内置 JS/Hermes 与资源、关闭调试并由维护者密钥签名。

## GitHub Actions 发布

仓库 Settings → Secrets and variables → Actions 中需配置以下 Repository secrets：

| 名称 | 内容 |
| --- | --- |
| `KEYSTORE_STORE_FILE_BASE64` | 正式签名密钥文件的 Base64 内容 |
| `KEYSTORE_KEY_ALIAS` | 密钥别名 |
| `KEYSTORE_PASSWORD` | 密钥库密码 |
| `KEYSTORE_KEY_PASSWORD` | 私钥密码 |

此仓库维护者首次发布时已配置签名 secrets；其他人克隆或 Fork 后必须配置自己的密钥，不能使用维护者密钥发布。

更新步骤：

1. 更新 `package.json` 的 `version`、递增 `versionCode`，同步 `package-lock.json` 根包信息。
2. 更新 `publish/release-notes.md`。发布成功后再同步 `publish/version.json` 的版本与说明，供应用检查更新。
3. 将修改推送到 `main`，创建对应版本标签，例如 `v1.0.1`，并推送标签。也可以对已存在的版本标签手动运行 `Android release` 工作流。
4. 工作流校验版本、运行 JS 检查、构建正式 APK 和 Android 单元测试，然后上传到 GitHub Releases。

面向普通用户分享 `https://github.com/margaretbriggs18101985rgu-crypto/music-plus/releases/latest`。用户无需 GitHub 账号即可下载公开 Release 的安装包。

正式应用标识为 `io.github.musicplus.player`，独立于原版 LX Music。不要改变已发布应用的标识或签名；否则原用户无法直接覆盖更新。
