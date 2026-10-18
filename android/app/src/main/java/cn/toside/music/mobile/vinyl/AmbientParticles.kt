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
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import kotlin.math.*
import kotlin.random.Random

internal const val STAR_BUCKETS = 24
internal const val MAX_AMBIENT_STARS = 6400
internal data class AmbientStar(val x: Float, val y: Float, val z: Float, val bucket: Int)

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
        AmbientStar(x, y, z, size * 8 + tint * 2 + brightness)
    }
}

/** Shared camera and caller-owned point buffers: no per-star allocations or trig per frame. */
internal fun projectAmbientStars(stars: List<AmbientStar>, width: Float, height: Float,
    yaw: Float, pitch: Float, points: Array<FloatArray>, used: IntArray) {
    used.fill(0)
    if (width <= 0f || height <= 0f || !yaw.isFinite() || !pitch.isFinite()) return
    val cy = cos(yaw); val sy = sin(yaw); val cp = cos(pitch); val sp = sin(pitch)
    val unit = minOf(width, height)
    val focal = unit * 2.8f
    for (star in stars) {
        val x = star.x * width * .38f
        val y = star.y * height * .68f
        val z = star.z * unit * .8f
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
internal fun AmbientParticles(trackId: String, count: Int, phase: State<Double>, drag: LyricStageDrag) {
    if (count == 0) return
    val stars = remember(trackId, count) { createAmbientStars(trackId.hashCode(), count) }
    Box(Modifier.fillMaxSize().clipToBounds().clearAndSetSemantics { }.drawWithCache {
        val points = ambientStarBuffers(stars)
        val used = IntArray(STAR_BUCKETS)
        val colors = intArrayOf(0xFF6F889F.toInt(), 0xFF92A4BB.toInt(), 0xFF9FBAC8.toInt(), 0xFFBCD0DD.toInt())
        val paints = Array(STAR_BUCKETS) { bucket -> Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = colors[(bucket % 8) / 2]
            strokeCap = Paint.Cap.ROUND
            strokeWidth = when (bucket / 8) { 0 -> .50.dp.toPx(); 1 -> .80.dp.toPx(); else -> 1.10.dp.toPx() }
        } }
        onDrawBehind {
            val time = phase.value
            // A slow orbit reveals real depth; no wrapping lanes, streaks, blur or old-frame feedback.
            val yaw = (drag.rotation.yaw * PI / 180.0 + sin(time * .025) * .045).toFloat()
            val pitch = (drag.rotation.pitch * PI / 180.0 + sin(time * .019) * .025).toFloat()
            projectAmbientStars(stars, size.width, size.height, yaw, pitch, points, used)
            drawIntoCanvas { canvas ->
                for (bucket in 0 until STAR_BUCKETS) {
                    val twinkle = .96f + sin(time * .19 + bucket * 1.7).toFloat() * .035f
                    paints[bucket].alpha = ((if (bucket % 2 == 0) 105 else 185) * twinkle).roundToInt()
                    if (used[bucket] > 0) canvas.nativeCanvas.drawPoints(points[bucket], 0, used[bucket], paints[bucket])
                }
            }
        }
    })
}
