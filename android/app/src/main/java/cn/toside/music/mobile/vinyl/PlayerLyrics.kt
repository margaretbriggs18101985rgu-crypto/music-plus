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
import kotlin.math.roundToInt
import kotlin.math.sin

private val LyricEase = CubicBezierEasing(.22f, 1f, .36f, 1f)
private fun lyricAlignment(value: String) = when (value) { "left" -> TextAlign.Left; "right" -> TextAlign.Right; else -> TextAlign.Center }

@Composable
internal fun PlayerLyrics(state: VinylPlayerState, modifier: Modifier,
    motionEnabled: Boolean, audio: State<AudioMotion>, phase: State<Double>, overlayTop: Dp = 0.dp, overlayBottom: Dp = 0.dp) = key(state.trackId) {
    if (state.lyricDisplayMode == "multiple" && state.lyrics.isNotEmpty()) {
        MultiplePlayerLyrics(state, modifier, motionEnabled, audio, overlayTop, overlayBottom)
    } else SinglePlayerLyrics(state, modifier, motionEnabled, audio, phase)
}

@Composable
private fun SinglePlayerLyrics(state: VinylPlayerState, modifier: Modifier,
    motionEnabled: Boolean, audio: State<AudioMotion>, phase: State<Double>) {
    val color = Color(lyricColorArgb(state.lyricColor))
    val family = lyricFontFamily(state.lyricFontFamily)
    val synthesis = if (state.lyricFontFamily == "system") FontSynthesis.All else FontSynthesis.None
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    BoxWithConstraints(modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
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
            val font = remember(text, line?.translation, state.lyricFontSize, family, maxWidth, maxHeight, density.fontScale) {
                var fitted = minOf(state.lyricFontSize, when { text.length > 64 -> 27f; text.length > 32 || maxWidth < 360.dp -> 32f; else -> 44f })
                val width = with(density) { (maxWidth - 56.dp).roundToPx() }.coerceAtLeast(1)
                val available = with(density) { (maxHeight * .60f - if (line?.translation.isNullOrBlank()) 0.dp else 62.dp).toPx() }.coerceAtLeast(32f)
                while (fitted > 16f) {
                    val measured = measurer.measure(text, TextStyle(fontFamily = family, fontSynthesis = synthesis, fontSize = fitted.sp, lineHeight = (fitted * 1.4f).sp,
                        fontWeight = FontWeight.SemiBold), constraints = Constraints(maxWidth = width))
                    if (measured.size.height <= available) break
                    fitted = (fitted - 2f).coerceAtLeast(16f)
                }
                fitted
            }
            Column(Modifier.fillMaxWidth().graphicsLayer {
                val sound = if (current && state.isPlaying && motionEnabled) audio.value else AudioMotion()
                val t = phase.value
                // Share the ambient phase, rather than jumping to another oscillation per line.
                val breathe = if (motionEnabled && state.isPlaying) (sin(t * .65) * .006).toFloat() else 0f
                scaleX = 1f + breathe + sound.bass * .012f
                scaleY = scaleX
                translationY = if (motionEnabled) (-sin(t * .42).toFloat() * 2f - sound.bass).dp.toPx() else 0f
                rotationX = pitch.value
                rotationZ = if (motionEnabled) (sin(t * .28) * .25).toFloat() else 0f
                cameraDistance = 1000.dp.toPx()
            }.semantics {
                if (current) { liveRegion = LiveRegionMode.Polite; contentDescription = text }
                else invisibleToUser()
            }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                BasicText(text, modifier = Modifier.fillMaxWidth(), style = TextStyle(fontFamily = family, fontSynthesis = synthesis,
                    brush = Brush.verticalGradient(listOf(lerp(color, Color.White, .85f), lerp(color, Color.White, .55f))),
                    fontSize = font.sp, lineHeight = (font * 1.4f).sp, fontWeight = FontWeight.SemiBold,
                    textAlign = lyricAlignment(state.lyricAlign), shadow = Shadow(color.copy(alpha = .38f), Offset.Zero, 18f)))
                if (!line?.translation.isNullOrBlank()) BasicText(line!!.translation, maxLines = 2, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth().padding(top = 16.dp), style = TextStyle(fontFamily = family, fontSynthesis = synthesis, color = VinylPalette.White.copy(alpha = .68f),
                        fontSize = 15.sp, lineHeight = 23.sp, textAlign = lyricAlignment(state.lyricAlign)))
            }
        }
    }
}

@Composable
private fun MultiplePlayerLyrics(state: VinylPlayerState, modifier: Modifier, motionEnabled: Boolean, audio: State<AudioMotion>, overlayTop: Dp, overlayBottom: Dp) {
    val active = state.activeLyric.coerceIn(-1, state.lyrics.lastIndex)
    val camera = remember { Animatable(active.toFloat()) }
    LaunchedEffect(active, motionEnabled, state.seekRevision) {
        // Seek directly to distant lines; adjacent lines keep their velocity on interruption.
        if (!motionEnabled || abs(active - camera.value) > 3f) camera.snapTo(active.toFloat())
        else camera.animateTo(active.toFloat(), spring(dampingRatio = 1f, stiffness = 95f, visibilityThreshold = .001f))
    }
    val window by remember(state.lyrics.size) { derivedStateOf { lyricScrollWindow(camera.value, state.lyrics.size) } }
    val color = Color(lyricColorArgb(state.lyricColor))
    val family = lyricFontFamily(state.lyricFontFamily)
    val synthesis = if (state.lyricFontFamily == "system") FontSynthesis.All else FontSynthesis.None
    val topGuard = animateDpAsState(overlayTop, tween(if (motionEnabled) 240 else 0), label = "lyric top chrome clearance")
    val bottomGuard = animateDpAsState(overlayBottom, tween(if (motionEnabled) 240 else 0), label = "lyric bottom chrome clearance")
    BoxWithConstraints(modifier.clipToBounds(), contentAlignment = Alignment.Center) {
        val font = minOf(state.lyricFontSize, when { maxHeight < 300.dp -> 20f; maxHeight < 420.dp || maxWidth < 360.dp -> 28f; else -> 34f })
        val gap = when { maxHeight < 300.dp -> 6.dp; maxHeight < 420.dp -> 18.dp; else -> 24.dp }
        Layout(modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp), content = {
            for (index in window) key(index) {
                val line = state.lyrics[index]
                val textColor by animateColorAsState(if (index == active) Color.White else color,
                    tween(if (motionEnabled) 420 else 0), label = "lyric focus color")
                Column(Modifier.fillMaxWidth().semantics {
                    if (index == active) { liveRegion = LiveRegionMode.Polite; contentDescription = line.text }
                    else invisibleToUser()
                }, horizontalAlignment = Alignment.CenterHorizontally) {
                    // Emphasis changes layers, never typography/layout, so rows do not reflow.
                    BasicText(line.text.ifBlank { "♪" }, modifier = Modifier.fillMaxWidth(), maxLines = 4,
                        overflow = TextOverflow.Ellipsis, style = TextStyle(fontFamily = family, fontSynthesis = synthesis, color = textColor,
                            fontSize = font.sp, lineHeight = (font * 1.38f).sp,
                            fontWeight = FontWeight.Bold, textAlign = lyricAlignment(state.lyricAlign),
                            shadow = Shadow(color.copy(alpha = .25f), Offset.Zero, 12f)))
                    if (line.translation.isNotBlank()) BasicText(line.translation, maxLines = 2,
                        overflow = TextOverflow.Ellipsis, modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        style = TextStyle(fontFamily = family, fontSynthesis = synthesis, color = color.copy(alpha = .62f), fontSize = 14.sp,
                            lineHeight = 21.sp, textAlign = lyricAlignment(state.lyricAlign)))
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
                    val edge = ((constraints.maxHeight * .5f - abs(y - constraints.maxHeight * .5f)) /
                        (constraints.maxHeight * .16f).coerceAtLeast(1f)).coerceIn(0f, 1f)
                    val chromeClearance = if (distance < .05f) 1f else (minOf(
                        y - row.height / 2f - topGuard.value.toPx(),
                        constraints.maxHeight - bottomGuard.value.toPx() - y - row.height / 2f) /
                        (constraints.maxHeight * .06f).coerceAtLeast(1f)).coerceIn(0f, 1f)
                    row.placeRelativeWithLayer(0, (y - row.height / 2f).roundToInt()) {
                        val sound = if (state.isPlaying && motionEnabled) audio.value else AudioMotion()
                        alpha = (.48f + focus * .52f) * edge * chromeClearance
                        scaleX = .80f + focus * .20f + sound.bass * focus * .01f
                        scaleY = scaleX
                        rotationX = if (motionEnabled) ((window.first + slot - cursor) * -3f).coerceIn(-9f, 9f) else 0f
                        cameraDistance = 1000.dp.toPx()
                    }
                }
            }
        }
    }
}
