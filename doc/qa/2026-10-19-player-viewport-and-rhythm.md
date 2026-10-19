# Adaptive lyrics, control hiding and independent rhythm switches

Date: 2026-10-19 (Asia/Hong_Kong).

## Result

- The record page's landscape dock now owns blank-space taps and hides the chrome immediately when unlocked. Progress gestures and playback buttons retain their own input. Locking pins the chrome; the existing three-second timeout still works when unlocked.
- Fullscreen lyrics reserve the dock's measured height and the top navigation height only while those controls are visible. Hiding releases that area. The record page's right lyric column also releases its top and bottom control clearance. A first tap after hiding reveals controls on the current page; it cannot also switch pages during recomposition.
- Single- and multi-line font sizes, translations and row gaps adapt continuously to the actual viewport dimensions, system font scale and saved font preference. Single-line text is measured to fit its remaining height with translation. The lyric rendering window grows for tall viewports, bounded to 33 rows; the active row remains centered using measured wrapped/translated row heights.
- `player.lyricPulseEnabled` now controls both lyric text pulse and the audio-driven stage camera. Previously it only stopped the text pulse. `player.starPulseEnabled` adds an independently persisted star-rhythm switch, passed from RN settings to the native policy and particle renderer. Normal lyric progression/transitions and ambient drift retain their separate settings.
- Both switches are reachable from the player's More menu, under “歌词颜色与粒子特效”. Simplified Chinese, Traditional Chinese and English labels describe their scope. Existing user selections are preserved; missing star-rhythm preferences default to enabled, retaining existing behavior.

GitHub research used AndroidX Media3's `PlayerView` touch-to-toggle control visibility implementation. This change extends the existing Compose components without adding dependencies.

## Verification

- `npm run typecheck`: passed.
- Targeted ESLint for modified TS/TSX and settings tests: passed.
- `node --test tools/test-immersive-settings.cjs`: 13 passed, including all four independent rhythm selections and settings reload.
- Existing reactive-visual and playback-sync tests: 11 passed.
- Android `:app:testDebugUnitTest`: 54 passed, zero failures/errors/skips, including viewport sizing, bounded context expansion and native rhythm policy independence.
- `:app:assembleDebug -PstandaloneDebug=true -PreactNativeArchitectures=x86_64`: passed; installed on `MusicPlus_QA_20261017`, Android API 37.
- `python tools/test-player-viewport.py`: passed. Real Android pointer input verified immediate blank-tap hiding, locked behavior, automatic hiding, revealing without mode switches, favorite/seek gesture routing, fullscreen/record layouts, single-line resizing, portrait controls, wrapped lyrics and track-end lyrics. Fullscreen landscape viewport expanded from 564px to 1006px; the sampled adjacent text height grew from 61px to 108px. The record-column viewport expanded from 587px to 974px.
- The real RN settings panel was exercised on Android: both rhythm switches could be toggled independently, remained disabled after force-stopping/restarting the process, and left lyric transitions/background drift unchanged. Original emulator choices were restored after verification.
- `npm run pack:android:debug`: passed for all four ABIs; APK contents verified to contain arm64-v8a, armeabi-v7a, x86 and x86_64.
- `git diff --check`: passed.

## Evidence and artifact

- UI metrics: `build/adaptive-player-qa/viewport-results.json`.
- Screenshot pairs: `fullscreen-landscape-shown.png`, `fullscreen-landscape-hidden.png`, `record-landscape-shown.png`, `record-landscape-hidden.png`, `single-landscape-shown.png`, `single-landscape-hidden.png` in `build/adaptive-player-qa/`.
- Portrait checks: `portrait-multiple.png`, `portrait-long-line.png`, `portrait-last-line.png` in the same folder.
- Real settings UI: `build/adaptive-player-qa/rhythm-settings-results.json`, `rhythm-switches-off.png` and `rhythm-switches-restored-off.png`.
- Build logs: `build/adaptive-player-build-final.log`, `build/adaptive-player-universal-build.log`.
- Debug APK: `build/apk/music-plus-v1.1.5-debug-universal.apk`.
- SHA-256: `cd9f41239a273f9b7b4208f9199ce4dea0a389bb43b93a42af4b4368ee558aae`.

The layout tests use explicitly labelled Debug lyric fixtures and do not establish audio playback or real-song beat alignment. Physical-device motion, performance and OEM-specific insets remain unverified. The APK is a Debug build; it uses the debug signing key and cannot replace a differently signed production install. No version bump, GitHub push or release publication was performed.
