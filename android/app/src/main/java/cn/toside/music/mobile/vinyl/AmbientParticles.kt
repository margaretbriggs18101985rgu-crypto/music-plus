package cn.toside.music.mobile.vinyl

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.ui.unit.dp
import kotlin.math.sin
import kotlin.random.Random

internal data class AmbientParticle(val x: Float, val y: Float, val speed: Float, val radius: Float, val depth: Float, val phase: Float)

internal fun createAmbientParticles(seed: Int, count: Int): List<AmbientParticle> {
    val random = Random(seed)
    return List(count.coerceIn(0, 42)) { index ->
        AmbientParticle(random.nextFloat(), random.nextFloat(), .0015f + random.nextFloat() * .003f,
            .65f + random.nextFloat() * 1.15f, listOf(.15f, .30f, .45f)[index % 3], random.nextFloat() * 6.28f)
    }
}

internal fun ambientFraction(value: Double): Float = if (value.isFinite()) (value - kotlin.math.floor(value)).toFloat() else 0f

@Composable
internal fun AmbientParticles(trackId: String, count: Int, palette: AmbientPalette, phase: State<Double>,
    drag: LyricStageDrag, active: Boolean, motionAllowed: Boolean) {
    if (count == 0) return
    val particles = remember(trackId, count) { createAmbientParticles(trackId.hashCode(), count) }
    val strength = animateFloatAsState(if (active) .30f else .12f, tween(if (motionAllowed) 240 else 0), label = "particle strength")
    val accent by animateColorAsState(Color(palette.accent), tween(if (motionAllowed) 700 else 0), label = "particle accent")
    Box(Modifier.fillMaxSize().clipToBounds().clearAndSetSemantics { }.drawWithCache {
        val color = accent
        val bokehRadius = 22.dp.toPx()
        val bokeh = Brush.radialGradient(listOf(color.copy(alpha = .16f), Color.Transparent), Offset.Zero, bokehRadius)
        onDrawBehind {
            val time = phase.value
            particles.forEachIndexed { index, particle ->
                val x = ambientFraction(particle.x + sin(time / 31 + particle.phase) * .025) * size.width
                val y = ambientFraction(particle.y - time * particle.speed) * size.height
                val edge = minOf(y / (size.height * .1f), (size.height - y) / (size.height * .1f)).coerceIn(0f, 1f)
                val center = Offset(x + drag.offset.floatValue * particle.depth, y)
                val twinkle = (.8 + sin(time / 7 + particle.phase) * .2).toFloat()
                drawCircle(color, particle.radius.dp.toPx(), center, alpha = strength.value * edge * twinkle)
                if (index < (if (count <= 16) 2 else 4)) {
                    translate(center.x, center.y) { drawCircle(bokeh, bokehRadius, Offset.Zero, alpha = strength.value) }
                }
            }
        }
    })
}
