# 双布局沉浸式播放器

2026-10-18，依据用户提供的三组星空／歌词舞台截图及黑胶分栏参考调整。

## 使用

- 黑胶＋歌词模式：横屏左侧黑胶、右侧歌曲资料与歌词、进度和播放控制；竖屏上方黑胶、中部歌词、底部控制。点击唱片或右上角“歌词”进入全屏模式。
- 全屏歌词模式：单句／多排使用原有设置；横竖屏均在可用安全区域内居中。右上角“唱片”返回黑胶＋歌词模式。
- 底部控制栏完全透明，不绘制胶囊边框、面板底色或阴影。竖屏恢复原有歌手／操作、带时间的进度和五键播放比例，横屏保留对称的横向排列；播放键居中。全屏模式点击控制区域中无按钮的空白处隐藏控制栏和顶部操作，轻点歌词舞台恢复。按钮和进度拖动不会触发隐藏。
- 两种布局都显示星空。保留特效开关、粒子档位、减少动画与省电适配；暂停时星空停在当前姿态。横屏避让刘海及系统导航栏。
- 更多播放设置 → 歌词排版与翻译 → 歌词字体：提供默认字体、霞鹜文楷、站酷小薇和站酷庆科黄油体。卡片显示真实字体预览，选择立即保存，单句／多排、黑胶／全屏及横竖屏共用；无需联网下载。字体同时用于测量和显示，切换后重新计算换行及居中。

## 字体来源与授权

三款字体均以未经修改的原始 TTF 随包提供；仅 Android 资源文件名不同。字体自行保留 SIL OFL 1.1 授权，不受本项目 Apache 2.0 授权替代。完整版权、OFL 文本及来源提交／SHA-256 清单位于 `android/app/src/main/assets/font-licenses/`，也包含于 APK。站酷小薇以简体为主；未覆盖的繁体及生僻字由 Android 系统字体回退，避免缺字。

- [霞鹜文楷 Lite](https://github.com/lxgw/LxgwWenKai-Lite)，Regular，提交 `b712c83d98acf977bacfb7fb010207802808bda9`。
- [站酷小薇](https://github.com/google/fonts/tree/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/zcoolxiaowei)与[站酷庆科黄油体](https://github.com/google/fonts/tree/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/zcoolqingkehuangyou)，Regular，Google Fonts 提交 `47d54ca1ebb14fd864695f1d39dc734f39017c33`。

三款字库原始数据合计 28,591,964 字节（27.27 MiB）；打包增量以最终 APK 为准。没有为减体积裁掉中文歌词字形。预览与原生舞台引用同一份文件，自定义字体不合成粗体，以保留原始笔画。

字体在 Release APK 中压缩后合计 15,166,144 字节（14.46 MiB）。设置页切换子面板会从顶部开始，避免主菜单滚动位置遮住第一个字体选项。更新字体不会改写字号、对齐、颜色或播放偏好。

## 原生截图

- [字体选择与真实预览](ui/player-font-picker.png)
- 黑胶＋歌词：[竖屏](ui/immersive-record-portrait.png)／[横屏](ui/immersive-record-landscape.png)
- 全屏歌词：[竖屏](ui/immersive-fullscreen-portrait.png)／[横屏](ui/immersive-fullscreen-landscape.png)

布局截图来自标注“动画演示 · 无音频”的 Debug 场景；字体选择截图来自实际 React Native 设置页。

## 实现

视觉与运动参考 [Mineradio-paused](https://github.com/XxHuberrr/Mineradio-paused)，查阅版本 `d43de565acabfdc1a9c9820a27e81a98ccbebcef`。本次新增 Android 实现独立编写，未引入该仓库的 WebGL 运行时、素材或源码。

- 星空使用固定种子的三维星群与弯曲星带。自动／低／高档位为 3600／1200／6400 个点，低内存设备限制至低档位。按大小、冷白色调和亮度分为 24 组，通过原生 Canvas 批量 `drawPoints` 绘制；每帧复用坐标数组。没有星点尾线、流星、模糊滤镜或上一帧叠加反馈。
- 多排歌词只保留附近 9 行，使用实际测量高度插值定位，临界阻尼弹簧保留相邻切句的连续速度。字号和字重不因高亮改变，避免重新换行；远距离跳转直接定位目标窗口。
- 单句切换使用固定舞台、小幅位移、渐变及轻微景深；双击回正也有缓动。真实 PCM 分析继续用于克制的歌词律动。
- 控制栏覆盖歌词舞台，不占用其测量高度，因此隐藏／显示不会改变歌词位置。两种模式分别保存手势状态，避免退场内容取消入场内容的旋转。
- 启动恢复缓存时，以当前播放选择对象校验异步结果；旧歌曲的封面、歌词、进度和失败提示不会覆盖后来的选择。用户音源事件解码保留原始共享事件，避免多个订阅者重复解析对象导致冷启动报错。

## 复现

```powershell
npm run typecheck
npm run lint
npm test
cd android
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:assembleRelease :app:testReleaseUnitTest -PstandaloneDebug=true '-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64' --offline --console=plain --max-workers=2
cd ..
$playerVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
adb install -r "android/app/build/outputs/apk/debug/music-plus-v$playerVersion-universal.apk"
python tools/test-player-motion.py
```

`tools/test-player-motion.py` 使用明确标注“动画演示 · 无音频”的 Debug 数据，检查真实界面点击、首尾跳转、横屏、对称布局、隐藏／恢复、快速切句与减少动画，并保存原生截图和录屏。不能用这项测试冒充音频播放验证。

本地证据目录：`build/motion-qa/`，控制栏修正复测在 `build/transparent-controls-qa/`。测试与视觉验收结果记录在根目录 `design-qa.md`。`npm run pack:android` 按当前 package.json 版本将正式签名包和 SHA256SUMS.txt 输出到 `build/apk/`；公开安装包以 [GitHub Releases](https://github.com/margaretbriggs18101985rgu-crypto/music-plus/releases) 为准。
