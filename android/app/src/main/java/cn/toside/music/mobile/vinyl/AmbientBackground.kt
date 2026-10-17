package cn.toside.music.mobile.vinyl

import android.util.Log
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.semantics.clearAndSetSemantics
import cn.toside.music.mobile.BuildConfig
import kotlin.math.cos
import kotlin.math.sin

@Composable
internal fun rememberAmbientPhase(trackId: String, running: Boolean): State<Double> {
    val clock = remember(trackId) { AmbientAnimationClock() }
    val phase = remember(trackId) { mutableDoubleStateOf(0.0) }
    LaunchedEffect(clock, running) {
        clock.pause()
        if (BuildConfig.DEBUG) Log.d("ImmersiveAmbient", "running=$running phase=${clock.seconds}")
        if (running) try {
            while (true) withFrameNanos { phase.doubleValue = clock.frame(it) }
        } finally { clock.pause() }
    }
    return phase
}

@Composable
internal fun AmbientBackground(palette: AmbientPalette, phase: State<Double>, drag: LyricStageDrag,
    active: Boolean, colorMotion: Boolean) {
    val transition = tween<Color>(if (colorMotion) 700 else 0)
    val top by animateColorAsState(Color(palette.top), transition, label = "ambient top")
    val middle by animateColorAsState(Color(palette.middle), transition, label = "ambient middle")
    val bottom by animateColorAsState(Color(palette.bottom), transition, label = "ambient bottom")
    val accent by animateColorAsState(Color(palette.accent), transition, label = "ambient accent")
    val strength = animateFloatAsState(if (active) .20f else .11f, tween(if (colorMotion) 240 else 0), label = "ambient strength")
    Box(Modifier.fillMaxSize().clipToBounds().clearAndSetSemantics { }
        .background(Brush.verticalGradient(listOf(top, middle, bottom)))
        .drawWithCache {
            val radius = size.width * .76f
            val glow = Brush.radialGradient(listOf(accent, Color.Transparent), center = Offset.Zero, radius = radius)
            onDrawBehind {
                val time = phase.value
                val shift = drag.offset.floatValue * .15f
                for (i in 0..3) {
                    val x = size.width * (.18f + i * .23f + sin(time / (17 + i * 4) + i) * .055f).toFloat() + shift
                    val y = size.height * (.22f + i * .15f + cos(time / (21 + i * 3) + i) * .035f).toFloat()
                    translate(x, y) { drawCircle(glow, radius = radius, center = Offset.Zero, alpha = strength.value) }
                }
                drawRect(Color.Black.copy(alpha = .20f)) // readability mask, below all controls/text
            }
        })
}
