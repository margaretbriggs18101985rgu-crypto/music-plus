package cn.toside.music.mobile.vinyl

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow

internal fun stageColor(color: Color, tension: Float): Color {
    val gray = color.red * .2126f + color.green * .7152f + color.blue * .0722f
    fun channel(value: Float) = (gray + (value - gray) * tension).coerceIn(0f, 1f)
    return Color(channel(color.red), channel(color.green), channel(color.blue), color.alpha)
}

internal fun lyricVisuals(state: VinylPlayerState): ReactiveVisuals = if (state.immersiveVisualsEnabled) state.reactiveVisuals
    else state.reactiveVisuals.copy(bloom = 0f, outlineHighlight = false, colorTension = 1f)

/** Static text layout; only the cached outline layer's opacity follows audio. */
@Composable
internal fun ReactiveLyricText(text: String, modifier: Modifier, style: TextStyle,
    fx: ReactiveVisuals, audio: State<AudioMotion>, reactive: Boolean, tint: Color,
    maxLines: Int = Int.MAX_VALUE, overflow: TextOverflow = TextOverflow.Clip) {
    Box(modifier) {
        if (fx.outlineHighlight) BasicText(text, maxLines = maxLines, overflow = overflow,
            modifier = Modifier.fillMaxWidth().graphicsLayer {
                alpha = if (reactive) .55f + audio.value.beat * .35f else .55f
            }.clearAndSetSemantics { },
            style = style.copy(brush = SolidColor(tint), drawStyle = Stroke(width = 1.6f),
                shadow = if (fx.bloom > 0f) Shadow(tint.copy(alpha = .65f), Offset.Zero, 16f * fx.bloom) else null))
        BasicText(text, maxLines = maxLines, overflow = overflow, modifier = Modifier.fillMaxWidth(),
            style = style.copy(shadow = if (fx.bloom > 0f) Shadow(tint.copy(alpha = .45f), Offset.Zero, 20f * fx.bloom) else null))
    }
}
