package cn.toside.music.mobile.vinyl

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate

/** Reference coordinates in a 400 × 480 stage, pivot at (200, 28). */
@Composable
internal fun Tonearm(engaged: Boolean, modifier: Modifier = Modifier) {
    val swing by animateFloatAsState(if (engaged) 0f else -16f, tween(600), label = "tonearm")
    Canvas(modifier) {
        val s = size.width / 400f
        fun point(x: Float, y: Float) = Offset(x * s, y * s)
        // Rotate around the actual bearing coordinate, independent of stage height.
        rotate(swing, point(200f, 28f)) {
        drawCircle(Color.Black.copy(alpha = .13f), 15 * s, point(200f, 28f))
        drawCircle(VinylPalette.White, 8.2f * s, point(200f, 28f))
        drawCircle(Color(0xFFE1E5E8), 3f * s, point(200f, 28f))
        val arm = Path().apply {
            moveTo(203f * s, 33f * s)
            cubicTo(208f * s, 62f * s, 215f * s, 103f * s, 226f * s, 119f * s)
            quadraticBezierTo(230f * s, 126f * s, 237f * s, 133f * s)
            lineTo(273f * s, 169f * s)
        }
        drawPath(arm, Color.Black.copy(alpha = .12f), style = Stroke(5.5f * s, cap = StrokeCap.Round))
        drawPath(arm, VinylPalette.White, style = Stroke(4.2f * s, cap = StrokeCap.Round))
        rotate(45f, point(273f, 169f)) {
            drawRoundRect(VinylPalette.White, point(271f, 164f), Size(26f * s, 10f * s), CornerRadius(2f * s))
            drawRoundRect(Color.White, point(295f, 161f), Size(15f * s, 16f * s), CornerRadius(3f * s))
            drawLine(Color(0xFFAFB6BF), point(299f, 165f), point(307f, 165f), 1f * s)
            drawLine(Color(0xFFAFB6BF), point(299f, 172f), point(307f, 172f), 1f * s)
        }
        }
    }
}
