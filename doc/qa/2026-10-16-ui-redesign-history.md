# LX Music × MineRadio 界面改造

源码以 [LX Music 移动版](https://github.com/lyswhut/lx-music-mobile) 的 `dev` 分支（`fb84807`）为基础。视觉参考 [MineRadio Mobile](https://github.com/MorsBrenn/mineradio-mobile) 的近黑背景、薄荷色强调、圆角面板与封面优先布局，以 React Native 原生组件实现。

## 已实现

- 新增「夜航 · MineRadio」主题：统一背景、文字、描边、卡片和选中状态。新安装默认使用夜航，已有安装可在设置 → 主题中切换。保留其他主题与自定义主题。
- 搜索首页：音乐氛围卡片、歌单探索入口、排行榜和我的音乐快捷入口。热搜与搜索历史仍按原设置显示。装饰波形是静态图形。
- 竖屏导航：品牌标题、菜单按钮、五个常用页面的底部导航；沿用原导航事件和滑动页面。
- 播放条：圆角浮动面板、歌曲名和歌手分层显示、明显的主播放按钮、独立进度线，保留状态、时长、拖动进度和键盘自动隐藏。
- 歌单和歌曲列表：封面卡片、圆角缩略图、字体层级、来源标记和播放中的封面提示。保留多选、长按、菜单和播放行为。
- 播放详情：大封面、阴影、下方歌曲信息、突出主播放按钮、可点击的封面/歌词切换，封面根据剩余空间缩放。
- 歌单详情与设置：更清楚的封面标题和设置分组卡片。抽屉与横屏封面也采用统一圆角。
- 新增文案覆盖简体中文、繁体中文、英文；导航与主要播放按钮增加可访问名称。

音乐检索、音源、音频播放、歌词、歌单数据和同步使用洛雪原有实现。没有移植 MineRadio 的后端、3D 场景或播放器引擎。

## 浏览器预览

预览复用实际界面组件，通过适配层提供示例状态。示例歌曲和原创 SVG 封面仅用于视觉检查，不会加入原生应用的数据。预览中的页面组合、搜索框和部分工具按钮为演示；不能据此验证真实音源、音频播放或 Android 原生效果。

```sh
cd tools/ui-preview
npm install
npm start
```

打开 <http://127.0.0.1:4173>。可以切换导航、查看播放页、切换主题和语言，以及检查播放/下一首状态。

旧版预览截图保存于 `doc/ui/`。新增 `vinyl-*-android.png` 为真实 Android 模拟器截图，其余浏览器截图不代表原生验收。

## 验证

- 2026-10-16：依赖检查、完整 `npm run typecheck` 和 `npm run lint` 通过；此前记录的类型诊断已修复。
- JDK 17 / Android SDK 已安装并验证。真实四 ABI Debug APK 已构建、安装和启动；内置 JS/Hermes，可脱离 Metro 运行。
- 保留前期 MineRadio 风格首页、搜索、歌单、播放条、主题改造。竖屏播放详情新增原生 Compose 黑胶页，原有歌词及更多设置仍可进入。
- 新页仅加入有对应功能的入口，已移除福利、心动、播客、笔记、评论等装饰性入口；“返回”回到原有主界面。
- 已在模拟器点按验证导航、歌词、菜单、真实本地测试音频的播放/暂停/Seek/上下首、收藏持久化和短时后台/系统媒体键。
- 旋转时钟 3 项单元测试、模拟器暂停保持/续转测试、常见屏与窄屏截图检查通过。完整记录见 [VINYL_PLAYER.md](VINYL_PLAYER.md) 与根目录 `design-qa.md`。
- 真机声音、横屏整体设计回归、系统大字号、长时间后台、外部音源与同步端到端仍待验证。

原生开发与构建沿用项目现有流程：安装依赖后使用 `npm run dev`；APK 构建需要 Android SDK 和 JDK。Git 依赖包含构建步骤，正常安装时须执行依赖准备脚本。

## 主要文件

- `src/theme/design.ts`：共享视觉色彩。
- `src/theme/themes/createThemes.js`：夜航主题源配置；修改后运行 `npm run build:theme`。
- `src/screens/Home/Vertical/`：标题、抽屉和底部导航。
- `src/screens/Home/Views/Search/BlankView/ListeningHome.tsx`：搜索首页。
- `src/components/player/PlayerBar/`：浮动播放条。
- `src/screens/PlayDetail/Vertical/`：竖屏播放页。
- `tools/ui-preview/`：独立的浏览器组件预览，不参与原生应用打包。

上游的 Apache-2.0 许可和原作者信息保持在原项目中。
