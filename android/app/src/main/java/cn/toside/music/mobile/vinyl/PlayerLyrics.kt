package cn.toside.music.mobile.vinyl

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.sin

private fun lyricAlignment(value: String) = when (value) { "left" -> TextAlign.Left; "right" -> TextAlign.Right; else -> TextAlign.Center }

/** Current-line stage with an outgoing depth layer, matching mineradio's spatial lyrics. */
@Composable
internal fun PlayerLyrics(state: VinylPlayerState, modifier: Modifier,
    motionEnabled: Boolean, audio: State<AudioMotion>, phase: State<Double>) = key(state.trackId) {
    if (state.lyricDisplayMode == "multiple" && state.lyrics.isNotEmpty()) {
        MultiplePlayerLyrics(state, modifier, motionEnabled, audio)
    } else SinglePlayerLyrics(state, modifier, motionEnabled, audio, phase)
}

@Composable
private fun SinglePlayerLyrics(state: VinylPlayerState, modifier: Modifier,
    motionEnabled: Boolean, audio: State<AudioMotion>, phase: State<Double>) {
    val lyricColor = Color(lyricColorArgb(state.lyricColor))
    BoxWithConstraints(modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        val lineIndex = state.activeLyric.takeIf { it in state.lyrics.indices } ?: -1
        AnimatedContent(targetState = lineIndex, contentAlignment = Alignment.Center,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 30.dp),
            transitionSpec = {
                if (!motionEnabled) fadeIn(tween(0)) togetherWith fadeOut(tween(0))
                else (fadeIn(tween(520)) + scaleIn(tween(900, easing = CubicBezierEasing(.16f, .84f, .32f, 1f)), .70f) +
                    slideInVertically(tween(900)) { (it * .35f).toInt() }) togetherWith
                    (fadeOut(tween(700)) + scaleOut(tween(700), .78f) + slideOutVertically(tween(700)) { -(it * .25f).toInt() })
            }, label = "spatial lyric") { index ->
            val line = state.lyrics.getOrNull(index)
            val current = index == lineIndex
            val pitch by transition.animateFloat(transitionSpec = { tween(if (motionEnabled) 900 else 0) }, label = "lyric entrance pitch") {
                when (it) { EnterExitState.PreEnter -> 28f; EnterExitState.Visible -> 0f; EnterExitState.PostExit -> -22f }
            }
            val yaw by transition.animateFloat(transitionSpec = { tween(if (motionEnabled) 900 else 0) }, label = "lyric entrance yaw") {
                when (it) { EnterExitState.PreEnter -> -22f; EnterExitState.Visible -> 0f; EnterExitState.PostExit -> 18f }
            }
            val text = line?.text?.takeIf { it.isNotBlank() } ?:
                if (state.lyrics.isEmpty()) { if (state.hasTrack) "暂无歌词" else "选择歌曲后显示歌词" } else "♪"
            val font = minOf(state.lyricFontSize, when { text.length > 64 -> 28f; text.length > 32 || maxWidth < 360.dp -> 34f; else -> 56f })
            Column(Modifier.fillMaxWidth().graphicsLayer {
                val sound = if (current && state.isPlaying && motionEnabled) audio.value else AudioMotion()
                val t = phase.value
                val breathe = if (motionEnabled && state.isPlaying) (sin(t * .92 + index) * .035 + sin(t * .41) * .02).toFloat() else 0f
                scaleX = 1f + breathe + sound.bass * .038f + sound.energy * .014f
                scaleY = scaleX + sound.mid * .012f
                translationY = if (motionEnabled) (-sin(t * .55 + index).toFloat() * 5 - sound.bass * 3).dp.toPx() else 0f
                translationX = (sound.treble - sound.mid) * 1.5.dp.toPx()
                rotationX = if (motionEnabled) pitch else 0f
                rotationY = if (motionEnabled) yaw else 0f
                rotationZ = if (motionEnabled) (sin(t * .34 + index) * 1.03).toFloat() + (sound.treble - sound.bass) * .45f else 0f
                cameraDistance = 900.dp.toPx()
            }.semantics {
                if (current) { liveRegion = LiveRegionMode.Polite; contentDescription = text }
                else invisibleToUser()
            }, horizontalAlignment = Alignment.CenterHorizontally) {
                BasicText(text, modifier = Modifier.fillMaxWidth().drawWithCache {
                    val glow = Brush.radialGradient(listOf(lyricColor, lyricColor.copy(alpha = .25f), Color.Transparent),
                        center = Offset(size.width / 2, size.height / 2), radius = size.width.coerceAtLeast(1f) * .58f)
                    onDrawBehind {
                        val sound = if (current && state.isPlaying && motionEnabled) audio.value else AudioMotion()
                        scale(1f + sound.bass * .18f, .40f + sound.mid * .10f) {
                            drawCircle(glow, size.width * .58f, center, alpha = if (state.immersiveVisualsEnabled) .08f + sound.energy * .24f else 0f)
                        }
                    }
                }, style = TextStyle(
                    brush = Brush.verticalGradient(listOf(lerp(lyricColor, Color.White, .35f), lyricColor, lerp(lyricColor, Color.Black, .10f))),
                    fontSize = font.sp, lineHeight = (font * 1.35f).sp, fontWeight = FontWeight.Bold,
                    textAlign = lyricAlignment(state.lyricAlign),
                    shadow = Shadow(lyricColor.copy(alpha = .65f), Offset.Zero, 24f)))
                if (!line?.translation.isNullOrBlank()) BasicText(line!!.translation,
                    modifier = Modifier.padding(top = 18.dp), style = TextStyle(color = VinylPalette.White.copy(alpha = .70f),
                        fontSize = 16.sp, lineHeight = 24.sp, textAlign = TextAlign.Center))
            }
        }
    }
}

@Composable
private fun MultiplePlayerLyrics(state: VinylPlayerState, modifier: Modifier, motionEnabled: Boolean, audio: State<AudioMotion>) {
    val active = state.activeLyric.coerceIn(0, state.lyrics.lastIndex)
    val color = Color(lyricColorArgb(state.lyricColor))
    BoxWithConstraints(modifier, contentAlignment = Alignment.Center) {
        val compact = maxHeight < 420.dp
        Column(Modifier.fillMaxWidth().padding(horizontal = 32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            for (index in visibleLyricIndices(active, state.lyrics.size)) key(index) {
                val current = index == active
                val line = state.lyrics[index]
                val opacity by animateFloatAsState(if (current) 1f else .38f,
                    tween(if (motionEnabled) 280 else 0), label = "lyric row emphasis")
                Column(Modifier.fillMaxWidth().padding(vertical = if (compact) 9.dp else 16.dp)
                    .graphicsLayer {
                        alpha = opacity
                        val sound = if (current && state.isPlaying && motionEnabled) audio.value else AudioMotion()
                        scaleX = 1f + sound.bass * .038f + sound.energy * .014f
                        scaleY = scaleX
                        translationY = -sound.bass * 3.dp.toPx()
                    }.semantics { if (current) liveRegion = LiveRegionMode.Polite },
                    horizontalAlignment = Alignment.CenterHorizontally) {
                    val rowFont = state.lyricFontSize * if (current) { if (compact) .70f else .85f } else .50f
                    BasicText(line.text.ifBlank { "♪" }, modifier = Modifier.fillMaxWidth(), maxLines = if (current) 4 else 2,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                        style = TextStyle(color = color, fontSize = rowFont.sp,
                            lineHeight = (rowFont * 1.3f).sp,
                            fontWeight = if (current) FontWeight.Bold else FontWeight.Medium, textAlign = lyricAlignment(state.lyricAlign),
                            shadow = if (current) Shadow(color.copy(alpha = .55f), Offset.Zero, 20f) else null))
                    if (current && line.translation.isNotBlank()) BasicText(line.translation, maxLines = 2,
                        modifier = Modifier.padding(top = 8.dp), style = TextStyle(color = color.copy(alpha = .7f),
                            fontSize = 15.sp, lineHeight = 22.sp, textAlign = TextAlign.Center))
                }
            }
        }
    }
}
