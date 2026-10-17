package cn.toside.music.mobile.vinyl

import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlin.math.max
import kotlin.math.min
import cn.toside.music.mobile.BuildConfig

@Composable
internal fun PlayerScreen(state: VinylPlayerState, clock: VinylRotationClock = remember { VinylRotationClock() },
    visualConfig: ImmersiveVisualConfig = ImmersiveVisualConfig(), onAction: PlayerAction = { _, _ -> }) {
    val drag = remember(state.trackId, state.lyricsVisible) { LyricStageDrag() }
    val environment = rememberImmersiveEnvironment()
    val policy = resolveAmbientPolicy(visualConfig, environment, state.lyricsVisible)
    LaunchedEffect(policy, state.lyricsVisible) {
        if (BuildConfig.DEBUG) Log.d("ImmersivePolicy", "lyrics=${state.lyricsVisible} animate=${policy.animate} particles=${policy.particleCount} lyricMotion=${policy.lyricMotion}")
    }
    val artwork = rememberPlayerArtwork(state)
    val palette = rememberArtworkPalette(artwork)
    val active = policy.animate && state.isPlaying && state.hasTrack
    val phase = rememberAmbientPhase(state.trackId, active)
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(VinylPalette.Top, VinylPalette.Middle, VinylPalette.Bottom)))) {
        if (state.lyricsVisible) {
            val colors = if (visualConfig.visualEffectsEnabled) palette.value else AmbientPalette.Fallback
            AmbientBackground(colors, phase, drag, active, policy.colorMotion)
            AmbientParticles(state.trackId, policy.particleCount, colors, phase, drag, active, policy.colorMotion)
        }
        Column(Modifier.fillMaxSize()
            .padding(top = state.topInset.dp, bottom = state.bottomInset.dp)) {
            PlayerTopNavigation(state, onAction)
            if (state.lyricsVisible) {
                ImmersiveLyricStage(state, drag, policy.lyricMotion, Modifier.weight(1f), onAction)
                Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), horizontalArrangement = Arrangement.End) {
                    ArtistLink(state, onAction, Modifier.weight(1f).padding(start = 4.dp, end = 8.dp))
                    PlayerIconButton(PlayerIcon.Heart, if (state.favorite) "取消喜欢" else "喜欢", enabled = state.hasTrack,
                        color = if (state.favorite) VinylPalette.Red else VinylPalette.Muted, selected = state.favorite) { onAction("favorite", 0.0) }
                    PlayerIconButton(PlayerIcon.Comment, "歌曲评论", enabled = state.hasTrack && !state.demo, color = VinylPalette.Muted) { onAction("comment", 0.0) }
                }
            } else {
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                    val diameter = min(maxWidth.value * .82f, max(120f, maxHeight.value - 62f)).dp
                    Box(Modifier.align(Alignment.BottomCenter).padding(bottom = 8.dp).size(diameter + 20.dp)
                        .background(Color.White.copy(alpha = .018f), CircleShape).border(1.dp, Color.White.copy(alpha = .055f), CircleShape))
                    VinylRecord(state, diameter, clock, artwork, Modifier.align(Alignment.BottomCenter).padding(bottom = 18.dp)
                        .clickable { onAction("lyrics", 1.0) })
                    Tonearm(engaged = !state.isStopped && state.hasTrack, Modifier.fillMaxSize())
                }
                Spacer(Modifier.height(18.dp))
                SongInfo(state, onAction)
            }
            Spacer(Modifier.height(8.dp))
            PlaybackProgress(state, onAction)
            PlaybackControls(state, onAction)
            PlayerViewSwitch(state, onAction)
        }
    }
}
