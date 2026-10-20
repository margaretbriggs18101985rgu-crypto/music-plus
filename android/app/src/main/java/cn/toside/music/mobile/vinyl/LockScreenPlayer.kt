package cn.toside.music.mobile.vinyl

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Portrait record + multiple lyric lines, independent of the in-app page/chrome preference. */
@Composable
internal fun LockScreenPlayer(state: VinylPlayerState, clock: VinylRotationClock, onDismiss: () -> Unit) {
    val display = state.copy(lyricsVisible = false, lyricDisplayMode = "multiple", lyricAlign = "center",
        lyricFontSize = state.lyricFontSize.coerceAtMost(28f))
    val customWallpaper = hasPlayerWallpaper(display)
    val environment = rememberImmersiveEnvironment()
    val policy = resolveAmbientPolicy(visualConfigForState(display), environment, display.hasTrack)
    val drag = remember(display.trackId) { LyricStageDrag() }
    val phase = rememberAmbientPhase(display.trackId, policy.animate && display.isPlaying && !customWallpaper, display.reactiveVisuals.speed)
    val audio = rememberAudioMotion(display.trackId, policy.colorMotion, display.isPlaying, display.reactiveVisuals, display.seekRevision)
    val artwork = rememberPlayerArtwork(display)
    Box(Modifier.fillMaxSize().background(Color.Black)) {
        if (customWallpaper) {
            PlayerWallpaper(display)
            // Keep metadata and the quiet lyric rows readable over busy or bright media.
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(
                Color.Black.copy(alpha = .12f), Color.Black.copy(alpha = .18f), Color.Black.copy(alpha = .60f)))))
        }
        else AmbientParticles(display.trackId, policy.particleCount, phase, drag, audio, display.reactiveVisuals, policy.starPulse && display.isPlaying)
        if (display.immersiveVisualsEnabled && display.reactiveVisuals.backgroundDim > 0f)
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = display.reactiveVisuals.backgroundDim * .5f)))
        if (policy.colorMotion) ReactiveSoundscape(audio, phase, display.reactiveVisuals, Color(lyricColorArgb(display.lyricColor)))
        Column(Modifier.fillMaxSize().padding(start = display.startInset.dp, end = display.endInset.dp,
            top = display.topInset.dp, bottom = display.bottomInset.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            if (display.demo) PageText("界面测试 · 无音频", style = TextStyle(color = Color.Gray, fontSize = 12.sp))
            Spacer(Modifier.height(4.dp))
            Box(Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth().padding(horizontal = 56.dp, vertical = 6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally) {
                    PageText(display.title, maxLines = 2, overflow = TextOverflow.Ellipsis,
                        style = TextStyle(color = Color.White, fontSize = 20.sp, lineHeight = 27.sp,
                            fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center))
                    if (display.artist.isNotBlank()) PageText(display.artist,
                        modifier = Modifier.padding(top = 6.dp), maxLines = 1, overflow = TextOverflow.Ellipsis,
                        style = TextStyle(color = Color.White.copy(alpha = .62f), fontSize = 14.sp,
                            textAlign = TextAlign.Center))
                }
                Box(Modifier.align(Alignment.CenterStart).size(48.dp)
                    .clickable(role = Role.Button, onClickLabel = "返回系统锁屏", onClick = onDismiss)
                    .semantics { contentDescription = "返回系统锁屏" }, contentAlignment = Alignment.Center) {
                    PageText("‹", style = TextStyle(color = Color.White.copy(alpha = .65f), fontSize = 30.sp))
                }
            }
            BoxWithConstraints(Modifier.weight(.85f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                val diameter = minOf(maxWidth * .88f, maxHeight - 8.dp).coerceAtLeast(48.dp)
                VinylRecord(display, diameter, clock, artwork)
            }
            Spacer(Modifier.height(8.dp))
            ImmersiveLyricStage(display, drag, policy.lyricMotion, Modifier.weight(1.15f).fillMaxWidth(),
                audio, phase, pulseEnabled = policy.lyricPulse)
            Spacer(Modifier.height(4.dp))
        }
    }
}
