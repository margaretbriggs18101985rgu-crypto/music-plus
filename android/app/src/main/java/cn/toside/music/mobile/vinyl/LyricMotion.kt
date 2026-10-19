package cn.toside.music.mobile.vinyl

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.keyframes
import androidx.compose.runtime.*

/** Layer-only emphasis from actual audio. Time alone must never manufacture a beat. */
internal fun lyricTextPulse(seconds: Double, bass: Float, energy: Float, enabled: Boolean): Float {
    if (!enabled) return 0f
    val low = if (bass.isFinite()) bass.coerceIn(0f, 1f) else 0f
    val level = if (energy.isFinite()) energy.coerceIn(0f, 1f) else 0f
    return low * .022f + level * .008f
}

/** A single 360ms entrance per active line; pause/buffering cancels it without a fake beat loop. */
@Composable
internal fun rememberLyricEntrance(active: Boolean, playing: Boolean, motionEnabled: Boolean): State<Float> {
    val entrance = remember { Animatable(1f) }
    LaunchedEffect(active, motionEnabled) {
        entrance.snapTo(1f)
        if (active && playing && motionEnabled) {
            entrance.snapTo(.96f)
            entrance.animateTo(1f, keyframes {
                durationMillis = 360
                .96f at 0
                1.035f at 150
                1f at 360
            })
        }
    }
    // Playing is deliberately not an entrance key: resume must not bounce the same line again.
    LaunchedEffect(playing) { if (!playing) { entrance.stop(); entrance.snapTo(1f) } }
    return entrance.asState()
}
