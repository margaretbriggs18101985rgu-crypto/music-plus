package cn.toside.music.mobile.vinyl

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.style.ResolvedTextDirection
import androidx.compose.ui.text.style.TextOverflow
import kotlin.math.floor

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
    maxLines: Int = Int.MAX_VALUE, overflow: TextOverflow = TextOverflow.Clip,
    highlightProgress: (() -> Float)? = null) {
    var layout by remember(text, maxLines) { mutableStateOf<TextLayoutResult?>(null) }
    val textStyle = if (highlightProgress == null) style else style.copy(brush = SolidColor(tint))
    Box(modifier) {
        if (fx.outlineHighlight) BasicText(text, maxLines = maxLines, overflow = overflow,
            modifier = Modifier.fillMaxWidth().graphicsLayer {
                alpha = if (reactive) .55f + audio.value.beat * .35f else .55f
            }.clearAndSetSemantics { },
            style = style.copy(brush = SolidColor(tint), drawStyle = Stroke(width = 1.6f),
                shadow = if (fx.bloom > 0f) Shadow(tint.copy(alpha = .65f), Offset.Zero, 16f * fx.bloom) else null))
        BasicText(text, maxLines = maxLines, overflow = overflow, modifier = Modifier.fillMaxWidth(),
            style = textStyle.copy(shadow = if (fx.bloom > 0f) Shadow(tint.copy(alpha = .45f), Offset.Zero, 20f * fx.bloom) else null))
        if (highlightProgress != null) BasicText(text, maxLines = maxLines, overflow = overflow,
            onTextLayout = { layout = it },
            modifier = Modifier.fillMaxWidth().clearAndSetSemantics { }.drawWithCache {
                val path = Path()
                onDrawWithContent {
                    val measured = layout
                    val progress = highlightProgress().takeIf { it.isFinite() }?.coerceIn(0f, 1f) ?: 0f
                    if (measured != null && progress > 0f) {
                        path.reset()
                        appendLyricHighlight(path, measured, progress)
                        clipPath(path) { this@onDrawWithContent.drawContent() }
                    }
                }
            },
            style = style.copy(brush = SolidColor(Color.White), shadow = null))
    }
}

// TextLayoutResult supplies actual wrapped-row/glyph bounds, so a completed
// first row stays white while only the current character in the next row fills.
internal fun appendLyricHighlight(path: Path, layout: TextLayoutResult, progress: Float) {
    val characters = layout.layoutInput.text.length * progress
    for (row in 0 until layout.lineCount) {
        val start = layout.getLineStart(row)
        val end = layout.getLineEnd(row, visibleEnd = true)
        if (characters <= start || end <= start) continue
        val top = layout.getLineTop(row)
        val bottom = layout.getLineBottom(row)
        if (characters >= end) {
            path.addRect(Rect(layout.getLineLeft(row), top, layout.getLineRight(row), bottom))
        } else {
            val offset = floor(characters).toInt().coerceIn(start, end - 1)
            val fraction = characters - offset
            // Completed glyphs use Compose's bidi-aware selection geometry.
            if (offset > start) path.addPath(layout.getPathForRange(start, offset))
            val glyph = layout.getBoundingBox(offset)
            val rtl = layout.getBidiRunDirection(offset) == ResolvedTextDirection.Rtl
            val edge = if (rtl) glyph.right - glyph.width * fraction else glyph.left + glyph.width * fraction
            path.addRect(Rect(if (rtl) edge else glyph.left, top, if (rtl) glyph.right else edge, bottom))
        }
    }
}
