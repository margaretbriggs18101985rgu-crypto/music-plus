package cn.toside.music.mobile.vinyl

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import kotlin.math.*

/** 32 logarithmic PCM bands form a perspective grid. No procedural replacement for missing audio. */
@Composable
internal fun ReactiveSoundscape(audio: State<AudioMotion>, phase: State<Double>, fx: ReactiveVisuals, tint: Color) {
    if (!fx.spectrumEnabled && !fx.terrainEnabled) return
    Box(Modifier.fillMaxSize().clearAndSetSemantics { }.drawWithCache {
        val path = Path()
        val color = stageColor(tint, fx.colorTension)
        onDrawBehind {
            val frame = audio.value
            fun band(index: Int): Float {
                val weight = when { index < 11 -> fx.bassWeight; index < 25 -> fx.midWeight; else -> fx.trebleWeight }
                return (frame.spectrum.getOrElse(index) { 0f } * weight).coerceIn(0f, 1.5f)
            }
            val alpha = (1f - fx.backgroundDim * .85f)
            if (fx.terrainEnabled) {
                val baseY = size.height * fx.terrainOffset
                val depth = size.height * (.08f + fx.terrainDepth * .26f)
                val travel = (phase.value * .25 % 1.0).toFloat()
                for (row in 0..12) {
                    val perspective = ((row + travel) / 13f).coerceIn(0f, 1f)
                    val width = size.width * (.25f + perspective * 1.1f)
                    val y = baseY - depth + depth * perspective * perspective
                    path.reset()
                    for (i in 0..31) {
                        val x = size.width * .5f + (i / 31f - .5f) * width
                        val height = band(i) * size.height * .10f * fx.terrainHeight * (.25f + perspective * .75f)
                        if (i == 0) path.moveTo(x, y - height) else path.lineTo(x, y - height)
                    }
                    if (fx.particleGlow && fx.bloom > 0f) drawPath(path, color.copy(alpha = .07f * alpha * fx.bloom), style = Stroke(5.dp.toPx()))
                    drawPath(path, color.copy(alpha = (.08f + perspective * .32f) * alpha), style = Stroke((.5f + perspective * .7f).dp.toPx()))
                }
            }
            if (fx.spectrumEnabled) {
                val width = size.width * .68f
                val bottom = size.height * .78f
                val gap = width / 32f
                for (i in 0..31) {
                    val x = (size.width - width) * .5f + gap * (i + .5f)
                    val height = band(i) * size.height * .047f
                    if (height > .1f) drawLine(color.copy(alpha = .48f * alpha), Offset(x, bottom), Offset(x, bottom - height), gap * .36f, StrokeCap.Round)
                }
            }
        }
    })
}
