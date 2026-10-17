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
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import kotlin.math.sin
import kotlin.math.cos
import kotlin.random.Random

internal data class AmbientParticle(val x: Float, val y: Float, val speed: Float, val radius: Float, val depth: Float, val phase: Float)

internal fun createAmbientParticles(seed: Int, count: Int): List<AmbientParticle> {
    val random = Random(seed)
    return List(count.coerceIn(0, 420)) { index ->
        AmbientParticle(random.nextFloat(), random.nextFloat(), .0015f + random.nextFloat() * .003f,
            .65f + random.nextFloat() * 1.85f, listOf(.15f, .30f, .45f)[index % 3], random.nextFloat() * 6.28f)
    }
}

internal fun ambientFraction(value: Double): Float = if (value.isFinite()) (value - kotlin.math.floor(value)).toFloat() else 0f

@Composable
internal fun AmbientParticles(trackId: String, count: Int, palette: AmbientPalette, phase: State<Double>,
    drag: LyricStageDrag, active: Boolean, motionAllowed: Boolean, audio: State<AudioMotion>) {
    if (count == 0) return
    val particles = remember(trackId, count) { createAmbientParticles(trackId.hashCode(), count) }
    val strength = animateFloatAsState(if (active) .48f else .16f, tween(if (motionAllowed) 240 else 0), label = "particle strength")
    val accent by animateColorAsState(Color(palette.accent), tween(if (motionAllowed) 700 else 0), label = "particle accent")
    Box(Modifier.fillMaxSize().clipToBounds().clearAndSetSemantics { }.drawWithCache {
        val color = accent
        val bokehRadius = 22.dp.toPx()
        val bokeh = Brush.radialGradient(listOf(color.copy(alpha = .16f), Color.Transparent), Offset.Zero, bokehRadius)
        onDrawBehind {
            val time = phase.value
            val sound = if (active) audio.value else AudioMotion()
            particles.forEachIndexed { index, particle ->
                val drift = sin(time / (9 + index % 7) + particle.phase) * (.025 + particle.depth * .05)
                val flow = ambientFraction(particle.x + time * (.030 + particle.speed * 12))
                val river = index % 3 != 0 && count > 80
                val px = if (river) (flow - .5f) * 1.16f + .5f
                    else ambientFraction(particle.x + drift)
                val py = if (river) .43f + (index % 5 - 2) * .012f +
                    sin(flow * 6.283 * (1 + particle.depth) + particle.phase + time * .34).toFloat() * (.024f + particle.depth * .04f)
                    else ambientFraction(particle.y - time * particle.speed)
                val yaw = drag.rotation.yaw * Math.PI / 180
                val pitch = drag.rotation.pitch * Math.PI / 180
                val localX = (px - .5f) * size.width
                val localY = (py - .43f) * size.height
                val z = (particle.depth - .3f) * size.width * 1.8f
                val rotatedX = localX * cos(yaw) + z * sin(yaw)
                val rotatedZ = z * cos(yaw) - localX * sin(yaw)
                val perspective = (size.width * 2 / (size.width * 2 + rotatedZ)).toFloat().coerceIn(.7f, 1.4f)
                val x = size.width * .5f + rotatedX.toFloat() * perspective
                val y = size.height * .43f + (localY * cos(pitch) - rotatedZ * sin(pitch)).toFloat() * perspective
                val edge = minOf(y / (size.height * .1f), (size.height - y) / (size.height * .1f)).coerceIn(0f, 1f)
                val center = Offset(x +
                    (x - size.width / 2) * sound.bass * .035f, y - sound.mid * particle.depth * 14.dp.toPx())
                // Keep the lyric column quieter; brighter foreground dust lives near the edges.
                val readingMask = if (x in size.width * .18f..size.width * .82f && y in size.height * .22f..size.height * .72f) .45f else 1f
                val twinkle = (.65 + sin(time / (2 + index % 5) + particle.phase) * .35).toFloat()
                val alpha = (strength.value + sound.treble * .22f) * edge * twinkle * readingMask
                val radius = particle.radius.dp.toPx() * perspective * (1f + sound.bass * .6f)
                val tint = if (index % 3 == 0) Color.White else color
                drawCircle(tint, radius, center, alpha = alpha)
                if (index % 7 == 0 && count > 40) {
                    val tail = Offset(center.x - (3f + sound.treble * 9f).dp.toPx(), center.y + 7.dp.toPx())
                    drawLine(tint, tail, center, radius * .65f, cap = StrokeCap.Round, alpha = alpha * .45f)
                }
                if (index < (if (count <= 40) 3 else 10)) {
                    translate(center.x, center.y) { drawCircle(bokeh, bokehRadius, Offset.Zero, alpha = strength.value) }
                }
                if (index % 19 == 0 && count > 40) {
                    val arm = radius * (2f + sound.treble)
                    drawLine(tint, center - Offset(arm, 0f), center + Offset(arm, 0f), .65.dp.toPx(), alpha = alpha * .7f)
                    drawLine(tint, center - Offset(0f, arm), center + Offset(0f, arm), .65.dp.toPx(), alpha = alpha * .7f)
                }
            }
        }
    })
}
