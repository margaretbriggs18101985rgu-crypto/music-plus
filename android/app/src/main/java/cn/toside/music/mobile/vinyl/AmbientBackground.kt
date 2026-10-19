package cn.toside.music.mobile.vinyl

import android.util.Log
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.clearAndSetSemantics
import cn.toside.music.mobile.BuildConfig

@Composable
internal fun rememberAmbientPhase(trackId: String, running: Boolean, speed: Float = 1f): State<Double> {
    val clock = remember(trackId) { AmbientAnimationClock() }
    val phase = remember(trackId) { mutableDoubleStateOf(0.0) }
    val currentSpeed by rememberUpdatedState(speed)
    LaunchedEffect(clock, running) {
        clock.pause()
        if (BuildConfig.DEBUG) Log.d("ImmersiveAmbient", "running=$running phase=${clock.seconds}")
        if (running) try {
            while (true) withFrameNanos { phase.doubleValue = clock.frame(it, currentSpeed.toDouble()) }
        } finally { clock.pause() }
    }
    return phase
}

/** The supplied star-field references have a black sky, without colored fog. */
@Composable
internal fun AmbientBackground(playing: Boolean, lyricColor: Color, motion: Boolean) {
    val tint by animateColorAsState(if (playing) lerp(Color(0xFF05020B), lyricColor, .025f) else Color.Black,
        tween(if (motion) 900 else 0), label = "star sky playback tint")
    Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(Color.Black, tint))).clearAndSetSemantics { })
}
