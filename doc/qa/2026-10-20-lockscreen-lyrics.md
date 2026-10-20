# 锁屏黑胶歌词

日期：2026-10-20（Asia/Hong_Kong）。

## 行为

- 在「设置 → 播放设置 → 锁屏黑胶歌词」开启，默认关闭。首次开启检查悬浮窗权限，并在系统授权后返回时启用。部分厂商还需要单独允许锁屏显示或后台弹出界面。
- 音乐播放中、手机已锁定且屏幕亮起时，显示独立的竖屏界面：歌名和歌手在黑胶上方，黑胶使用当前歌曲封面，下方显示居中的多行同步歌词。长歌名最多两行，歌手最多一行并省略溢出。
- 数据订阅位于播放器初始化层，不依赖应用内全屏播放器是否挂载。复用当前播放器的歌曲、实际进度、歌词解析和逐字时间，不创建第二个音频播放器。
- 解锁、暂停、缓冲、停止或关闭设置会退出。左上角返回入口和系统返回键仅关闭该界面，当前锁屏周期不再弹出，下一次熄屏后重置。
- 系统锁屏保留。独立 Activity 不调用解锁接口，不强制点亮或保持屏幕常亮；熄屏及 Activity 停止时销毁 Compose composition，恢复可见时重建。
- 保留现有歌词字体、颜色和动态效果开关。锁屏星空直接使用播放器的粒子档位、背景运动、星空律动及全部 `reactiveVisuals` 参数，不再单独强制 Low；实时频谱和音域地形也复用播放器渲染层。熄屏显示/AOD 不在此次范围内。
- 「播放设置 → 锁屏自定义背景」独立选择图片、GIF 或静音视频，也能恢复黑色星空。它使用独立的 `player.lockScreenWallpaper.*` 设置，不修改 `theme.wallpaper.*`。自定义背景替代星空，并叠加渐变压暗以保留歌词可读性。
- 复用现有文件选择与私有目录导入流程。取消或不支持的文件保留原设置；替换及恢复默认只清理对应的旧导入目录。备份会清除锁屏背景的设备私有路径、文件名和类型，避免在另一台设备上恢复失效路径。

## 验证

- TypeScript 类型检查及修改文件的 ESLint：通过。
- `node --test tools/test-immersive-settings.cjs tools/test-lyric-words.cjs tools/test-lock-screen.cjs tools/test-completed-features.cjs`：58 项通过。新增覆盖后台歌词与进度桥接、星空设置实时传递、锁屏背景独立存储及重载、选择图片/GIF/视频、取消和无效文件、恢复默认、备份排除私有文件路径。
- `:app:testDebugUnitTest`：59 项通过，0 failures / errors。新增策略测试分别检查开关、歌曲、播放、锁定、亮屏、悬浮窗权限和本周期关闭状态。
- `:app:assembleDebug -PreactNativeArchitectures=x86_64 -PstandaloneDebug=true --offline`：通过；最新界面与解锁监测代码已包含在构建中。
- `git diff --check`：通过；修改和新增的文本源码未发现 NUL 字节。

## 模拟器检查

使用独立启动的 `MusicPlus_QA_20261017`、API 37、1080×2400。安装的是 x86_64 Debug 构建。`fixture-lockscreen-arm` 只存在于 Debug 预览 Activity，界面明确标注「界面测试 · 无音频」。

1. 授予悬浮窗权限后，熄屏再亮屏能启动真正的 `LockScreenActivity`。系统日志记录 `BAL_ALLOW_SAW_PERMISSION`；keyguard 同时保持 `showing=true`、`inputRestricted=true`。
2. 实际截图确认歌名、歌手位于黑胶上方，歌词显示当前行及前后行，底部返回区域没有遮挡歌词。
3. 点击「返回系统锁屏」后，keyguard 仍为 `showing=true`、`inputRestricted=true`，`occluded=false`；下一次熄屏/亮屏可再次显示黑胶。
4. `wm dismiss-keyguard` 后两秒内界面退出，回到预览 Activity，`showing=false`。可见期间的 keyguard 检查也能处理没有收到 `USER_PRESENT` 的退出路径。
5. 撤销悬浮窗权限后再熄屏/亮屏，系统锁屏不被覆盖：`showing=true`、`inputRestricted=true`、`occluded=false`。
6. 临时设置模拟器 PIN 后再次验证显示和系统返回：黑胶关闭后仍留在系统锁屏。测试结束已清除该测试凭据。

### 布局与独立背景补充检查

- 移除顶部弹性留白、缩小文字区内边距和唱片/歌词间距，将返回按钮移入顶部，底部空间交给歌词。相同模拟器与测试状态下：歌名顶部从 y=348 移到 y=208；唱片顶部从 y=534 移到 y=378；当前歌词中心上移 40 px；最后一行底边从 y=2211 延伸到 y=2272，更接近底部安全区域。以上数字是该 1080×2400 fixture 的测量结果。
- 检查 Low / High / Off 的真实截图。固定左侧背景条带中亮度至少 16 的像素分别为 88 / 686 / 0；这是像素比较，不是星星数量。证据：`compact-low.png`、`compact-high.png`、`compact-off.png` 和 `compact-star-counts.json`。
- 用系统文件选择器从 Downloads 选取测试 PNG，界面显示正确文件名和 image 类型，文件确实被复制到应用私有 `files/wallpapers/` 独立目录。图片背景实际绘制通过；视频背景也用已存在的界面录屏文件验证了原生视频层绘制。后者是无音频的视觉 fixture，不是歌曲播放测试。
- 最新背景压暗构建已安装，`compact-custom-image-final.png` 确认渐变压暗及歌词可读性。测试 UI 图中仍保留「界面测试 · 无音频」标签。
- 覆盖安装最新 APK 并正常冷启动后，设置页仍显示之前导入的 PNG；点击「恢复黑色星空」后文件名消失，对应私有导入目录已清理。证据：`settings-imported.xml`、`settings-restored.xml`、`settings-cleared.xml`。
- 冷启动后的设置检查使用正常 MainActivity；APK 重装后残留 Debug 预览任务栈的一次热恢复曾出现设置内容空白，强制停止并正常冷启动后恢复。该调试任务栈路径不作为真实播放验证。

证据：`build/lockscreen-qa/fixture-lockscreen-title.png`、`fixture-lockscreen-title.xml`，以及相邻的锁屏生命周期日志。截图中的歌曲、歌词和播放状态都是用于布局检查的测试输入，并无音频。

真机的真实歌曲同步、后台存活、蓝牙、功耗、指纹/人脸解锁及各厂商权限策略尚未验证。模拟器结果不代表上述测试已经通过。此次未发布版本。

## 方案参考

先检索了 GitHub 的 [APlayer](https://github.com/rRemix/APlayer) 等开源 Android 播放器方向，最终扩展本项目已有 Compose 黑胶和歌词组件，未引入新的运行时依赖。

Android 的后台 Activity 启动受系统限制，当前方案在权限允许时显示独立的锁屏 Activity；平台规则参考 [Android background activity launch restrictions](https://developer.android.com/guide/components/activities/background-starts)。后续提高 target SDK 时应重新验证相关权限例外，不能仅依赖此次 target SDK 29 的测试结果。
