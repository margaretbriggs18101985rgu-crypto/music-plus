package cn.toside.music.mobile.vinyl

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.FontSynthesis
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.sp
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.roundToInt

private val LyricEase = CubicBezierEasing(.22f, 1f, .36f, 1f)
private fun lyricAlignment(value: String) = when (value) { "left" -> TextAlign.Left; "right" -> TextAlign.Right; else -> TextAlign.Center }

@Composable
internal fun PlayerLyrics(state: VinylPlayerState, modifier: Modifier,
    motionEnabled: Boolean, audio: State<AudioMotion>, phase: State<Double>, overlayTop: Dp = 0.dp, overlayBottom: Dp = 0.dp,
    pulseEnabled: Boolean = motionEnabled && state.lyricPulseEnabled) = key(state.trackId) {
    // Center within the actual lyric viewport instead of fading future rows behind the dock.
    val viewport = modifier.padding(top = overlayTop, bottom = overlayBottom)
    if (state.lyricDisplayMode == "multiple" && state.lyrics.isNotEmpty()) {
        MultiplePlayerLyrics(state, viewport, motionEnabled, pulseEnabled, audio, phase)
    } else SinglePlayerLyrics(state, viewport, motionEnabled, pulseEnabled, audio, phase)
}

@Composable
private fun SinglePlayerLyrics(state: VinylPlayerState, modifier: Modifier,
    motionEnabled: Boolean, pulseEnabled: Boolean, audio: State<AudioMotion>, phase: State<Double>) {
    val fx = lyricVisuals(state)
    val color = stageColor(Color(lyricColorArgb(state.lyricColor)), fx.colorTension)
    val family = lyricFontFamily(state.lyricFontFamily)
    val synthesis = if (state.lyricFontFamily == "system") FontSynthesis.All else FontSynthesis.None
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    BoxWithConstraints(modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        val typography = lyricViewportTypography((maxWidth - 56.dp).value, maxHeight.value,
            state.lyricFontSize, density.fontScale, multiple = false)
        val slideDistance = with(density) { 26.dp.roundToPx() }
        val lineIndex = state.activeLyric.takeIf { it in state.lyrics.indices } ?: -1
        AnimatedContent(targetState = lineIndex, contentAlignment = Alignment.Center,
            // A fixed stage avoids a size animation when the incoming sentence wraps differently.
            modifier = Modifier.fillMaxSize().padding(horizontal = 28.dp),
            transitionSpec = {
                val direction = if (targetState >= initialState) 1 else -1
                if (!motionEnabled) fadeIn(tween(0)) togetherWith fadeOut(tween(0))
                else ((fadeIn(tween(380, 60, LyricEase)) +
                    slideInVertically(tween(640, easing = LyricEase)) { direction * slideDistance } +
                    scaleIn(tween(640, easing = LyricEase), .96f)) togetherWith
                    (fadeOut(tween(240)) +
                        slideOutVertically(tween(480, easing = LyricEase)) { -direction * slideDistance } +
                        scaleOut(tween(480, easing = LyricEase), .98f))).using(SizeTransform(clip = false))
            }, label = "lyric depth dissolve") { index ->
            val line = state.lyrics.getOrNull(index)
            val current = index == lineIndex
            val pitch = transition.animateFloat(transitionSpec = { tween(if (motionEnabled) 640 else 0, easing = LyricEase) }, label = "lyric depth pitch") {
                when (it) { EnterExitState.PreEnter -> 8f; EnterExitState.Visible -> 0f; EnterExitState.PostExit -> -6f }
            }
            val text = line?.text?.takeIf { it.isNotBlank() } ?:
                if (state.lyrics.isEmpty()) { if (state.hasTrack) "暂无歌词" else "选择歌曲后显示歌词" } else "♪"
            val translationFont = typography.translationSp
            val font = remember(text, line?.translation, typography, family, maxWidth, maxHeight, density.fontScale) {
                var fitted = typography.fontSp
                val width = with(density) { (maxWidth - 56.dp).roundToPx() }.coerceAtLeast(1)
                val translatedHeight = if (line?.translation.isNullOrBlank()) 0 else measurer.measure(line!!.translation,
                    TextStyle(fontFamily = family, fontSynthesis = synthesis, fontSize = translationFont.sp,
                        lineHeight = (translationFont * 1.5f).sp), maxLines = 2, constraints = Constraints(maxWidth = width)).size.height +
                    with(density) { 16.dp.roundToPx() }
                val available = (with(density) { (maxHeight * .9f).toPx() } - translatedHeight).coerceAtLeast(1f)
                while (fitted > 12f) {
                    val measured = measurer.measure(text, TextStyle(fontFamily = family, fontSynthesis = synthesis, fontSize = fitted.sp, lineHeight = (fitted * 1.4f).sp,
                        fontWeight = FontWeight.SemiBold), constraints = Constraints(maxWidth = width))
                    if (measured.size.height <= available) break
                    fitted = (fitted - 1f).coerceAtLeast(12f)
                }
                fitted
            }
            Column(Modifier.fillMaxWidth().graphicsLayer {
                val enabled = current && state.isPlaying && pulseEnabled
                val sound = if (enabled) audio.value else AudioMotion()
                val amount = lyricTextPulse(0.0, sound.beat * state.reactiveVisuals.bassWeight,
                    weightedAudioEnergy(sound, state.reactiveVisuals), enabled) * state.reactiveVisuals.intensity
                scaleX = 1f + amount
                scaleY = 1f + amount * .8f
                rotationX = pitch.value
                cameraDistance = 1000.dp.toPx()
            }.semantics {
                if (current) { liveRegion = LiveRegionMode.Polite; contentDescription = text }
                else invisibleToUser()
            }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                ReactiveLyricText(text, modifier = Modifier.fillMaxWidth(), fx = fx, audio = audio,
                    reactive = current && state.isPlaying && pulseEnabled, tint = color,
                    highlightProgress = lyricHighlightProgress(state.lyrics, index, state.position, state.duration, lineIndex),
                    style = TextStyle(fontFamily = family, fontSynthesis = synthesis,
                    brush = Brush.verticalGradient(listOf(lerp(color, Color.White, .85f), lerp(color, Color.White, .55f))),
                    fontSize = font.sp, lineHeight = (font * 1.4f).sp, fontWeight = FontWeight.SemiBold,
                    textAlign = lyricAlignment(state.lyricAlign), shadow = Shadow(color.copy(alpha = .38f), Offset.Zero, 18f)))
                if (!line?.translation.isNullOrBlank()) BasicText(line!!.translation, maxLines = 2, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth().padding(top = 16.dp), style = TextStyle(fontFamily = family, fontSynthesis = synthesis, color = VinylPalette.White.copy(alpha = .68f),
                        fontSize = translationFont.sp, lineHeight = (translationFont * 1.5f).sp, textAlign = lyricAlignment(state.lyricAlign)))
            }
        }
    }
}

@Composable
private fun MultiplePlayerLyrics(state: VinylPlayerState, modifier: Modifier, motionEnabled: Boolean,
    pulseEnabled: Boolean, audio: State<AudioMotion>, phase: State<Double>) {
    val active = state.activeLyric.coerceIn(-1, state.lyrics.lastIndex)
    val camera = remember { Animatable(active.toFloat()) }
    LaunchedEffect(active, motionEnabled, state.seekRevision) {
        // Seek directly to distant lines; adjacent lines keep their velocity on interruption.
        if (!motionEnabled || abs(active - camera.value) > 3f) camera.snapTo(active.toFloat())
        else camera.animateTo(active.toFloat(), spring(dampingRatio = 1f, stiffness = 95f, visibilityThreshold = .001f))
    }
    val fx = lyricVisuals(state)
    val color = stageColor(Color(lyricColorArgb(state.lyricColor)), fx.colorTension)
    val family = lyricFontFamily(state.lyricFontFamily)
    val synthesis = if (state.lyricFontFamily == "system") FontSynthesis.All else FontSynthesis.None
    val density = LocalDensity.current
    BoxWithConstraints(modifier.clipToBounds().semantics { contentDescription = "多排歌词区域" }, contentAlignment = Alignment.Center) {
        val typography = lyricViewportTypography((maxWidth - 48.dp).value, maxHeight.value,
            state.lyricFontSize, density.fontScale, multiple = true)
        val font = typography.fontSp
        val gap = typography.gapDp.dp
        val translationFont = typography.translationSp
        val radius = ceil(maxHeight.value / (font * density.fontScale * 1.38f + typography.gapDp) / 2f).toInt() + 1
        val window by remember(state.lyrics.size, radius) {
            derivedStateOf { lyricScrollWindow(camera.value, state.lyrics.size, radius) }
        }
        Layout(modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp), content = {
            for (index in window) key(index) {
                val line = state.lyrics[index]
                val textColor by animateColorAsState(if (index == active) Color.White else color,
                    tween(if (motionEnabled) 420 else 0), label = "lyric focus color")
                Column(Modifier.fillMaxWidth().semantics {
                    if (index == active) { liveRegion = LiveRegionMode.Polite; contentDescription = line.text }
                }, horizontalAlignment = Alignment.CenterHorizontally) {
                    // Emphasis changes layers, never typography/layout, so rows do not reflow.
                    ReactiveLyricText(line.text.ifBlank { "♪" }, modifier = Modifier.fillMaxWidth(), maxLines = 4,
                        fx = fx, audio = audio, reactive = index == active && state.isPlaying && pulseEnabled, tint = color,
                        highlightProgress = lyricHighlightProgress(state.lyrics, index, state.position, state.duration, active),
                        overflow = TextOverflow.Ellipsis, style = TextStyle(fontFamily = family, fontSynthesis = synthesis, color = textColor,
                            fontSize = font.sp, lineHeight = (font * 1.38f).sp,
                            fontWeight = FontWeight.Bold, textAlign = lyricAlignment(state.lyricAlign),
                            shadow = Shadow(color.copy(alpha = .25f), Offset.Zero, 12f)))
                    if (line.translation.isNotBlank()) BasicText(line.translation, maxLines = 2,
                        overflow = TextOverflow.Ellipsis, modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        style = TextStyle(fontFamily = family, fontSynthesis = synthesis, color = color.copy(alpha = .62f), fontSize = translationFont.sp,
                            lineHeight = (translationFont * 1.5f).sp, textAlign = lyricAlignment(state.lyricAlign)))
                }
            }
        }) { measurables, constraints ->
            val rows = measurables.map { it.measure(constraints.copy(minHeight = 0, maxHeight = Constraints.Infinity)) }
            val centers = lyricRowCenters(rows.map { it.height }.toIntArray(), gap.toPx())
            layout(constraints.maxWidth, constraints.maxHeight) {
                val cursor = camera.value
                val cameraY = lyricCameraCenter(cursor, window.first, centers)
                rows.forEachIndexed { slot, row ->
                    val distance = abs(window.first + slot - cursor)
                    val focus = (1f - distance).coerceIn(0f, 1f)
                    val y = constraints.maxHeight * .5f + centers[slot] - cameraY
                    val edge = (minOf(y + row.height / 2f, constraints.maxHeight - y + row.height / 2f) /
                        row.height.coerceAtLeast(1)).coerceIn(0f, 1f)
                    row.placeRelativeWithLayer(0, (y - row.height / 2f).roundToInt()) {
                        val enabled = state.isPlaying && pulseEnabled
                        val sound = if (enabled) audio.value else AudioMotion()
                        val amount = lyricTextPulse(0.0, sound.beat * state.reactiveVisuals.bassWeight,
                            weightedAudioEnergy(sound, state.reactiveVisuals), enabled) * focus * state.reactiveVisuals.intensity
                        alpha = (.62f + focus * .38f) * edge
                        scaleX = .90f + focus * .10f + amount
                        scaleY = .90f + focus * .10f + amount * .8f
                        rotationX = if (motionEnabled) ((window.first + slot - cursor) * -3f).coerceIn(-9f, 9f) else 0f
                        cameraDistance = 1000.dp.toPx()
                    }
                }
            }
        }
    }
}
