# Player particles, lyric viewport and landscape controls

Date: 2026-10-18 (Asia/Hong_Kong).

## Changes

- Stars receive independent seeded directions and speeds, wrap outside the viewport, and drift through the existing batched Canvas renderer. Motion continues while the visible player is paused, and stops with the background-motion switch, reduced-motion policy or Battery Saver.
- Explicit Low/High/Off particle choices now take precedence over the low-RAM heuristic. Only Auto adapts to low RAM: Low = 1,200, Auto = 3,600 (1,200 on low-RAM devices), High = 6,400, Off = 0. The master effect switch and system motion policy still apply.
- The lyric viewport reserves actual space for navigation and playback controls. Measured current-row centers align to that viewport; upcoming rows no longer disappear behind a bottom-clearance alpha mask. Nearby lines remain readable above and below the active line.
- Taps on artwork, lyrics and empty player space switch between record and lyric pages. The explicit mode button was removed. Buttons and scrubbing consume their gestures; dragging lyrics does not switch pages. The old double-tap reset and empty-dock hide gestures were removed to keep tap behavior consistent.
- `player.lyricPulseEnabled` adds a persisted, independent text-rhythm switch in the existing appearance settings, bridged to native state. It applies to single- and multi-line lyrics. Layer scaling provides a gentle timed rhythm, with additional accents from the existing decoded-audio envelope when available. This is not a BPM detector.
- Landscape places title and artist above the record, leaves the right column for lyrics, and hides the system navigation bar. The four equal-width playback slots contain Previous, Play/Pause, Next and Favorite. Progress stays above them. Settings remain accessible from the top-right menu.

## Verification

- `npm run typecheck`: passed.
- Targeted ESLint for modified TypeScript and the settings test: passed.
- `node --test tools/test-immersive-settings.cjs`: 6 passed, including default migration and persistence of the new switch.
- `:app:testDebugUnitTest`: 40 passed, no failures, errors or skips. Includes independent particle movement, visible density changes, explicit quality selection on low RAM, lyric geometry and pulse enable/disable behavior.
- `:app:assembleDebug -PstandaloneDebug=true -PreactNativeArchitectures=x86_64`: passed. Installed the completed artifact in the headless `MusicPlus_QA_20261017` emulator.
- `tools/test-player-motion.py`: passed at 1080x2400 portrait and 2400x1080 landscape. Checks current-row centering, visible previous/next lyrics, first/last lines, artwork/lyric tap round trips, equal four-button spacing, metadata above artwork, favorite taps without page switching, rapid line changes and reduced motion.
- `tools/test-player-effects.py`: passed using bundled Python/Pillow. A fixed side strip contained 67 lit pixels at Low and 316 at High; these are image pixels, not particle counts. Drift changed 753 pixels; frozen stars changed 0; Off contained 0 lit pixels. In the lyric crop, enabled text rhythm changed 17,756 pixels; disabled text rhythm changed 0. Background motion was disabled during the text comparisons.
- `git diff --check`: passed.

## Evidence

- Layout results: `build/player-fixes-qa/fixture-results.json`.
- Screenshots: `build/player-fixes-qa/portrait-multiple.png`, `landscape-multiple.png`, `landscape-vinyl.png`, `landscape-single.png`, `first-line.png`, `last-line.png`, `reduced-motion.png`.
- Actual Android transition recording: `build/player-fixes-qa/lyric-transitions.mp4`.
- Effect results and screenshot pairs: `build/player-effects-qa/effects-results.json` and adjacent PNGs.
- Native test XML: `android/app/build/test-results/testDebugUnitTest/`.
- Build log: `build/player-fixes-build-verified.log`.

The UI tests use the explicitly labelled native Debug preview fixture, not audio playback. Real-device performance, real-track beat alignment and OEM-specific navigation behavior have not been verified. The software-rendered emulator recorded substantial jank during screen recording, so these results establish layout and interaction correctness, not a phone frame-rate claim. No new release was published.

GitHub research before implementation included [ParticleEmitter](https://github.com/PiotrPrus/ParticleEmitter) and [React Native animation examples](https://github.com/AlirezaHadjar/react-native-animations). The existing native rendering layer was extended without adding a third-party runtime dependency.

## Follow-up: center the record group and reduce the play icon

The landscape title, artist and record are now measured as one group and centered vertically against the screen, accounting for unequal top/bottom system insets. The previous record-size budget is retained; the 56dp navigation clearance no longer sits entirely above the left column. The right lyric/control column retains its previous padding. The landscape Play/Pause icon changes from 34sp to 24sp with a 48dp touch target, matching the other controls' touch targets and preserving four equal-width slots.

The native Debug build passed (`build/player-centering-build.log`). The updated Android interaction check passed in portrait and landscape, including the group-centering and compact-control checks. Evidence: `build/player-centering-qa/fixture-results.json`, `build/player-centering-qa/landscape-vinyl.png`, and `build/player-centering-qa/landscape-multiple.png`. The fixture reports a title-to-record center of 522.5px on a 1080px-high screen; this excludes the outer decorative ring and lower stage spacing. The displayed group has balanced visible top and bottom space. The test also now waits for the initial activity surface before issuing fixture commands to avoid losing commands during a cold launch.
