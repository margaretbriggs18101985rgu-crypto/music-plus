package cn.toside.music.mobile.vinyl

import android.graphics.Paint
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import kotlin.math.*
import kotlin.random.Random

internal const val STAR_BUCKETS = 24
internal const val MAX_AMBIENT_STARS = 6400
internal data class AmbientStar(val x: Float, val y: Float, val z: Float, val bucket: Int,
    val velocityX: Float, val velocityY: Float, val velocityZ: Float)

/** Two uneven, narrow ribbons in a sparse volume. Positions are sampled once,
 * not randomized each frame. Quality changes preserve the existing population. */
internal fun createAmbientStars(seed: Int, count: Int): List<AmbientStar> {
    val random = Random(seed)
    return List(count.coerceIn(0, MAX_AMBIENT_STARS)) { index ->
        val u = random.nextFloat() * 2f - 1f
        val v = random.nextFloat()
        val w = random.nextFloat()
        val scatter = (random.nextFloat() + random.nextFloat() + random.nextFloat() - 1.5f)
        val ribbon = index % 10 < 7
        val arm = index % 2
        val x = u * 1.65f
        val y = if (ribbon) -.40f * u + sin(u * 3.1f + arm * .9f) * .22f +
            (arm - .5f) * .10f + scatter * (.025f + v * .10f)
            else (v - .5f) * 2.3f
        val z = if (ribbon) cos(u * 2.7f + arm) * .34f + (arm - .5f) * .35f + (w - .5f) * .16f
            else (w - .5f) * 1.7f
        val magnitude = random.nextFloat()
        val size = when { magnitude < .74f -> 0; magnitude < .96f -> 1; else -> 2 }
        val tint = random.nextInt(4)
        val brightness = if (random.nextFloat() < .66f) 0 else 1
        val direction = random.nextFloat() * (2f * PI.toFloat())
        val speed = .012f + random.nextFloat() * .025f
        AmbientStar(x, y, z, size * 8 + tint * 2 + brightness,
            cos(direction) * speed, sin(direction) * speed, (random.nextFloat() - .5f) * .018f)
    }
}

/** Shared camera and caller-owned point buffers: no per-star allocations or trig per frame. */
internal fun projectAmbientStars(stars: List<AmbientStar>, width: Float, height: Float,
    yaw: Float, pitch: Float, points: Array<FloatArray>, used: IntArray, elapsedSeconds: Double = 0.0,
    fx: ReactiveVisuals = ReactiveVisuals(), audio: AudioMotion = AudioMotion()) {
    used.fill(0)
    if (width <= 0f || height <= 0f || !yaw.isFinite() || !pitch.isFinite()) return
    val cy = cos(yaw); val sy = sin(yaw); val cp = cos(pitch); val sp = sin(pitch)
    val unit = minOf(width, height)
    val focal = unit * (3.2f - fx.depth * 2f)
    val time = if (elapsedSeconds.isFinite()) elapsedSeconds else 0.0
    val sway = sin(time * .45).toFloat() * .65f
    val twist = fx.twist * (.25f + sin(time * .07).toFloat() * .15f)
    val expansion = 1f + fx.scatter * .85f + audio.beat * fx.intensity * fx.bassWeight * .045f
    fun drift(position: Float, velocity: Float, extent: Float): Float {
        val span = extent * 2.0
        return (((position + velocity * time + extent) % span + span) % span - extent).toFloat()
    }
    for (star in stars) {
        val x = (drift(star.x, star.velocityX, 1.8f) + star.velocityY * sway + star.z * twist) * width * .38f * expansion
        val y = (drift(star.y, star.velocityY, 1.3f) + star.velocityX * sway + star.x * twist * .3f + star.velocityY * fx.scatter * 12f) * height * .68f * expansion
        val z = drift(star.z, star.velocityZ, 1f) * unit * (.5f + fx.depth * 1.5f)
        val rx = x * cy + z * sy
        val rz = z * cy - x * sy
        val ry = y * cp - rz * sp
        val depth = y * sp + rz * cp
        if (focal + depth < focal * .25f) continue
        val perspective = focal / (focal + depth)
        val px = width * .5f + rx * perspective
        val py = height * .48f + ry * perspective
        if (px < -4f || px > width + 4f || py < -4f || py > height + 4f) continue
        val bucket = star.bucket
        val offset = used[bucket]
        points[bucket][offset] = px
        points[bucket][offset + 1] = py
        used[bucket] = offset + 2
    }
}

internal fun ambientStarBuffers(stars: List<AmbientStar>): Array<FloatArray> {
    val sizes = IntArray(STAR_BUCKETS)
    for (star in stars) sizes[star.bucket] += 2
    return Array(STAR_BUCKETS) { FloatArray(sizes[it]) }
}

@Composable
internal fun AmbientParticles(trackId: String, count: Int, phase: State<Double>, drag: LyricStageDrag,
    audio: State<AudioMotion>, fx: ReactiveVisuals, reactive: Boolean) {
    if (count == 0 || !fx.starRiver) return
    val stars = remember(trackId, count) { createAmbientStars(trackId.hashCode(), count) }
    Box(Modifier.fillMaxSize().clipToBounds().clearAndSetSemantics { }.drawWithCache {
        val points = ambientStarBuffers(stars)
        val used = IntArray(STAR_BUCKETS)
        val colors = intArrayOf(0xFF6F889F.toInt(), 0xFF92A4BB.toInt(), 0xFF9FBAC8.toInt(), 0xFFBCD0DD.toInt())
        val paints = Array(STAR_BUCKETS) { bucket -> Paint(Paint.ANTI_ALIAS_FLAG).apply {
            val base = androidx.compose.ui.graphics.Color(colors[(bucket % 8) / 2])
            color = stageColor(base, fx.colorTension).toArgb()
            strokeCap = Paint.Cap.ROUND
            strokeWidth = (when (bucket / 8) { 0 -> .50.dp.toPx(); 1 -> .80.dp.toPx(); else -> 1.10.dp.toPx() }) * fx.particleSize
        } }
        val glows = Array(STAR_BUCKETS) { bucket -> Paint(paints[bucket]).apply { strokeWidth *= 4f } }
        onDrawBehind {
            val time = phase.value
            val sound = if (reactive) audio.value else AudioMotion()
            val camera = stageCamera(sound, fx, reactive)
            // Independent seeded velocities drift through the shared camera without per-frame randomness.
            val yaw = ((drag.rotation.yaw + camera.yaw) * PI / 180.0 + sin(time * .025) * .045).toFloat()
            val pitch = ((drag.rotation.pitch + camera.pitch) * PI / 180.0 + sin(time * .019) * .025).toFloat()
            projectAmbientStars(stars, size.width, size.height, yaw, pitch, points, used, time, fx, sound)
            drawIntoCanvas { canvas ->
                for (bucket in 0 until STAR_BUCKETS) {
                    val twinkle = .96f + sin(time * .19 + bucket * 1.7).toFloat() * .035f
                    val accent = 1f + (sound.treble * fx.trebleWeight * .15f + sound.beat * fx.bassWeight * .35f) * fx.intensity
                    paints[bucket].alpha = ((if (bucket % 2 == 0) 105 else 185) * twinkle * accent * (1f - fx.backgroundDim * .75f)).roundToInt().coerceIn(0, 255)
                    if (used[bucket] > 0) {
                        if (fx.particleGlow && fx.bloom > 0f) {
                            glows[bucket].alpha = (paints[bucket].alpha * .18f * fx.bloom).roundToInt().coerceIn(0, 255)
                            canvas.nativeCanvas.drawPoints(points[bucket], 0, used[bucket], glows[bucket])
                        }
                        canvas.nativeCanvas.drawPoints(points[bucket], 0, used[bucket], paints[bucket])
                    }
                }
            }
        }
    })
}
