# 内置墨澜音源

- 上游：[baiji6/molanyinyueyuan v2.3.4](https://github.com/baiji6/molanyinyueyuan)。按用户提供的原始下载链接获取。
- 原始脚本 SHA-256：`328e06c473dfc0ba6de338a7b04f00e3b67a69f59205ca6903d553a80b57c706`。
- 原始脚本文本与出处存于 `src/resources/user-api/molan-v2.3.4.json`，不执行构建机上的混淆脚本。
- 稳定 ID：`user_api_builtin_molan`，沿用现有独立 QuickJS 音源运行环境。
- 未选择音源的安装初始化为内置项；非空的已有选择和外部导入脚本不覆盖。
- 原音源管理的本地导入、在线导入、切换继续可用；内置脚本随应用更新，管理页标为内置并避免误删。
- MIT 许可：`android/app/src/main/assets/licenses/molanyinyueyuan-MIT.txt`，随 APK 分发。

隔离的空数据 Android 测试用户已实际验证：自动选中并初始化成功、管理页存在内置项、本地/在线导入可打开。原用户覆盖安装时已有选择继续保留。该初始化验证不代表所有第三方音源端点与音质长期可用。
