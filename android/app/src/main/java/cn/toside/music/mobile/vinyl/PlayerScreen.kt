package cn.toside.music.mobile.vinyl

import android.util.Log
import androidx.compose.animation.core.tween
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.TextStyle
import cn.toside.music.mobile.BuildConfig
import coil.compose.AsyncImagePainter
import kotlin.math.max
import kotlin.math.min

@Composable
internal fun PlayerScreen(state: VinylPlayerState, clock: VinylRotationClock = remember { VinylRotationClock() },
    visualConfig: ImmersiveVisualConfig = visualConfigForState(state), onAction: PlayerAction = { _, _ -> }) {
    val recordDrag = remember(state.trackId) { LyricStageDrag() }
    val lyricDrag = remember(state.trackId) { LyricStageDrag() }
    val drag = if (state.lyricsVisible) lyricDrag else recordDrag
    var controlsHidden by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(state.lyricsVisible) { controlsHidden = false }
    val environment = rememberImmersiveEnvironment()
    val policy = resolveAmbientPolicy(visualConfig, environment, state.hasTrack)
    LaunchedEffect(policy, state.lyricsVisible) {
        if (BuildConfig.DEBUG) Log.d("ImmersivePolicy", "lyrics=${state.lyricsVisible} animate=${policy.animate} particles=${policy.particleCount} lyricMotion=${policy.lyricMotion}")
    }
    val artwork = rememberPlayerArtwork(state)
    val active = policy.animate && state.isPlaying && state.hasTrack
    val phase = rememberAmbientPhase(state.trackId, active)
    val audio = rememberAudioMotion(state.trackId, state.hasTrack && policy.lyricMotion, state.isPlaying)
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(VinylPalette.Top, VinylPalette.Middle, VinylPalette.Bottom)))) {
        AmbientBackground(state.isPlaying && visualConfig.visualEffectsEnabled, Color(lyricColorArgb(state.lyricColor)), policy.colorMotion)
        AmbientParticles(state.trackId, policy.particleCount, phase, drag)
        BoxWithConstraints(Modifier.fillMaxSize().padding(start = state.startInset.dp, end = state.endInset.dp,
            top = state.topInset.dp, bottom = state.bottomInset.dp)) {
            val landscape = maxWidth > maxHeight
            Box(Modifier.fillMaxSize()) {
                PlayerModeTransition(state.lyricsVisible, policy.colorMotion, Modifier.fillMaxSize()) { lyrics, current ->
                    val bodyAction: PlayerAction = { action, value -> if (current) onAction(action, value) }
                    val bodyDrag = if (lyrics) lyricDrag else recordDrag
                    if (lyrics) {
                        Box(Modifier.fillMaxSize()) {
                            // The stage always fills the safe viewport. Chrome overlays it,
                            // so showing/hiding the dock never displaces the lyric center.
                            ImmersiveLyricStage(state, bodyDrag, policy.lyricMotion && current,
                                Modifier.fillMaxSize().semantics {
                                    if (controlsHidden) onClick("显示播放控制栏") { controlsHidden = false; true }
                                }, audio, phase, onTap = { controlsHidden = false }, overlayInsets = if (controlsHidden) PaddingValues()
                                    else PaddingValues(top = 56.dp, bottom = if (landscape) 112.dp else 232.dp))
                            AnimatedVisibility(!controlsHidden, modifier = Modifier.align(Alignment.BottomCenter),
                                enter = fadeIn(tween(if (policy.colorMotion) 240 else 0)) + slideInVertically(tween(if (policy.colorMotion) 240 else 0)) { it / 3 },
                                exit = fadeOut(tween(if (policy.colorMotion) 180 else 0)) + slideOutVertically(tween(if (policy.colorMotion) 180 else 0)) { it / 3 }) {
                                ImmersivePlaybackDock(state, artwork, landscape, onHide = { controlsHidden = true }, onAction = bodyAction)
                            }
                        }
                    } else Box(Modifier.fillMaxSize().padding(top = 56.dp)) {
                        RecordPage(state, clock, artwork, landscape, bodyDrag, policy.lyricMotion && current, audio, phase, bodyAction)
                    }
                }
                AnimatedVisibility(!state.lyricsVisible || !controlsHidden, modifier = Modifier.align(Alignment.TopCenter),
                    enter = fadeIn(tween(if (policy.colorMotion) 240 else 0)), exit = fadeOut(tween(if (policy.colorMotion) 180 else 0))) {
                    PlayerTopNavigation(state, onAction)
                }
            }
        }
    }
}

@Composable
private fun RecordPage(state: VinylPlayerState, clock: VinylRotationClock, artwork: AsyncImagePainter,
    landscape: Boolean, drag: LyricStageDrag, motion: Boolean, audio: State<AudioMotion>, phase: State<Double>, onAction: PlayerAction) {
    if (landscape) {
        Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
            RecordStage(state, clock, artwork, Modifier.weight(.46f).fillMaxHeight(), onAction)
            Column(Modifier.weight(.54f).fillMaxHeight().padding(end = 20.dp, bottom = 8.dp)) {
                SongInfo(state, onAction)
                ImmersiveLyricStage(state, drag, motion, Modifier.weight(1f), audio, phase)
                PlaybackProgress(state, onAction, compact = true)
                BasicText("${formatPlayerTime(state.position)} / ${formatPlayerTime(state.duration.takeIf { it > 0 } ?: Double.NaN)}",
                    modifier = Modifier.align(Alignment.End).padding(end = 20.dp), style = TextStyle(color = VinylPalette.Muted, fontSize = 10.sp))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f)) { PlaybackControls(state, onAction, compact = true) }
                    PlayerIconButton(PlayerIcon.More, "更多播放设置", 23, color = VinylPalette.Muted) { onAction("settings", 0.0) }
                }
            }
        }
    } else {
        Column(Modifier.fillMaxSize()) {
            RecordStage(state, clock, artwork, Modifier.weight(1f).fillMaxWidth(), onAction)
            ImmersiveLyricStage(state, drag, motion, Modifier.weight(.70f), audio, phase)
            ImmersivePlaybackDock(state, artwork, false, onHide = null, onAction = onAction)
        }
    }
}

@Composable
private fun RecordStage(state: VinylPlayerState, clock: VinylRotationClock, artwork: AsyncImagePainter,
    modifier: Modifier, onAction: PlayerAction) {
    BoxWithConstraints(modifier) {
        val diameter = min(maxWidth.value * .82f, max(80f, maxHeight.value - 28f)).dp
        Box(Modifier.align(Alignment.Center).size(diameter + 20.dp)
            .background(Color.White.copy(alpha = .018f), CircleShape).border(1.dp, Color.White.copy(alpha = .055f), CircleShape))
        VinylRecord(state, diameter, clock, artwork, Modifier.align(Alignment.Center)
            .clickable { onAction("lyrics", 1.0) })
    }
}
