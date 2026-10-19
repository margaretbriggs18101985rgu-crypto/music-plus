# 2026-10-19 音频视觉验收

本次在现有未提交修改上增量实现，未提交、推送、打标签或发布 GitHub Release。需求为改善固定抖动的歌词效果，参照 Mineradio 的频段/鼓点响应和视觉参数。后续补充要求：频谱柱可以设置，默认隐藏。

## 已验证

- TypeScript 检查通过；本次修改的 TS/TSX/测试文件 ESLint 通过。
- Node 测试 **159/159** 通过，包含旧设置默认补齐、视觉配置保存重载、无效参数归一化、频谱默认关闭。
- Android 单元测试 **47/47** 通过。新增覆盖：44.1/48/96 kHz 的 80/120/160 BPM 瞬态；持续低音、高频瞬态、静音；反相立体声；频谱峰值位置；手动检测频段；镜头开关、频段权重及缓慢视角跟随。
- 四 ABI 独立 Debug APK 构建成功，实际检查 APK 包含 `armeabi-v7a`、`arm64-v8a`、`x86`、`x86_64`，安装到 API 37 的 `emulator-5554` 成功。
- 通过真实 RN/TrackPlayer 播放本地立体声 PCM/LRC 测试文件，确认频段和鼓点从解码路径进入原生视觉，没有使用演示音频状态。
- 实际 UI 修改强度滑块到 1.50，开启粒子溢光、歌词描边和地形，并关闭频谱柱；检查真实 AsyncStorage 存储。APK 更新及应用冷启动后上述选择保留。
- 通过真实 UI 恢复默认参数，确认 `spectrumEnabled=false`、`terrainEnabled=false`、封面解码尺寸 512。
- 最终 APK 中播放现有歌曲 `Work (Derra Flip)`，关闭频谱显示时仍能取得实际频段与鼓点；约 12 秒实播内分析帧有效、频段及检测窗口随音频变化。已保存实播录屏，完成后暂停播放。

## 本地证据

本地 `build/` 为忽略输出目录，不随源码提交：

- `build/rhythm-qa/final-build.log`、`native-tests.log`、`all-js-tests.log`、`typecheck.log`、`lint.log`。
- `build/rhythm-qa/settings-basic-expanded.png`、`settings-particles-enabled.png`、`settings-terrain.png`、`settings-spectrum-off.png`。
- `build/rhythm-qa/final-default-controls.png`、`final-real-song-hidden-spectrum.png`。
- `build/rhythm-qa/real-song-motion.mp4`、`real-song-log.txt`。
- `build/apk/music-plus-v1.1.4-debug-universal.apk`，SHA-256：`c1dbcc1428ef5b4c65c3f3bd40b2c9d26d1dee424fec78e385732c13fde72d9c`。

## 验证边界

真实歌曲验证证明分析与渲染链路运行，不能证明任意编曲的鼓点检测都准确。测试没有标注整首歌曲的真实鼓点，也没有做完整曲库准确率统计。没有验证真机扬声器/蓝牙延迟、长时间功耗、TalkBack 操作或所有滑块的逐项真机视觉验收。

设置按类别独立生效；背景星河关闭或使用自定义壁纸时，星流参数会保留但不绘制星流。减少动画、后台及省电策略继续由已有策略控制，具体交互见 [音频视觉设置](../REACTIVE_VISUALS.md)。
