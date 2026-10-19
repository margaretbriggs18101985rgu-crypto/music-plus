package cn.toside.music.mobile.vinyl

import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.TextStyle
import cn.toside.music.mobile.BuildConfig
import coil.compose.AsyncImagePainter
import kotlin.math.max
import kotlin.math.min
import kotlin.math.abs
import kotlin.math.roundToInt

@Composable
internal fun PlayerScreen(state: VinylPlayerState, clock: VinylRotationClock = remember { VinylRotationClock() },
    visualConfig: ImmersiveVisualConfig = visualConfigForState(state), onAction: PlayerAction = { _, _ -> }) {
    val recordDrag = remember(state.trackId) { LyricStageDrag() }
    val lyricDrag = remember(state.trackId) { LyricStageDrag() }
    val drag = if (state.lyricsVisible) lyricDrag else recordDrag
    val environment = rememberImmersiveEnvironment()
    val policy = resolveAmbientPolicy(visualConfig, environment, state.hasTrack)
    LaunchedEffect(policy, state.lyricsVisible) {
        if (BuildConfig.DEBUG) Log.d("ImmersivePolicy", "lyrics=${state.lyricsVisible} animate=${policy.animate} particles=${policy.particleCount} lyricMotion=${policy.lyricMotion}")
    }
    val artwork = rememberPlayerArtwork(state)
    val customWallpaper = hasPlayerWallpaper(state)
    val phase = rememberAmbientPhase(state.trackId, policy.animate && state.hasTrack && !customWallpaper)
    val pulse = policy.colorMotion && state.lyricPulseEnabled
    val lyricPhase = rememberAmbientPhase(state.trackId, state.isPlaying && (pulse || policy.lyricMotion))
    val audio = rememberAudioMotion(state.trackId, state.hasTrack && pulse, state.isPlaying)
    val switchPage = { onAction("lyrics", if (state.lyricsVisible) 0.0 else 1.0) }
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(VinylPalette.Top, VinylPalette.Middle, VinylPalette.Bottom)))) {
        if (customWallpaper) PlayerWallpaper(state)
        else {
            AmbientBackground(state.isPlaying && visualConfig.visualEffectsEnabled, Color(lyricColorArgb(state.lyricColor)), policy.colorMotion)
            AmbientParticles(state.trackId, policy.particleCount, phase, drag)
        }
        BoxWithConstraints(Modifier.fillMaxSize().padding(start = state.startInset.dp, end = state.endInset.dp,
            top = state.topInset.dp, bottom = state.bottomInset.dp)) {
            val landscape = maxWidth > maxHeight
            Box(Modifier.fillMaxSize().pointerInput(state.lyricsVisible) {
                detectTapGestures { switchPage() }
            }.semantics {
                onClick(if (state.lyricsVisible) "切换到唱片" else "切换到歌词") { switchPage(); true }
            }) {
                PlayerModeTransition(state.lyricsVisible, policy.colorMotion, Modifier.fillMaxSize()) { lyrics, current ->
                    val bodyAction: PlayerAction = { action, value -> if (current) onAction(action, value) }
                    val bodyDrag = if (lyrics) lyricDrag else recordDrag
                    if (lyrics) {
                        Box(Modifier.fillMaxSize()) {
                            ImmersiveLyricStage(state, bodyDrag, policy.lyricMotion && current,
                                Modifier.fillMaxSize(), audio, lyricPhase,
                                onTap = { bodyAction("lyrics", 0.0) },
                                overlayInsets = PaddingValues(top = 56.dp, bottom = if (landscape) 116.dp else 232.dp),
                                pulseEnabled = pulse && current)
                            Box(Modifier.align(Alignment.BottomCenter)) {
                                ImmersivePlaybackDock(state, landscape, onAction = bodyAction)
                            }
                        }
                    } else Box(Modifier.fillMaxSize().padding(top = if (landscape) 0.dp else 56.dp)) {
                        RecordPage(state, clock, artwork, landscape, bodyDrag, policy.lyricMotion && current, pulse && current, audio, lyricPhase, bodyAction)
                    }
                }
                Box(Modifier.align(Alignment.TopCenter)) {
                    PlayerTopNavigation(state, onAction, showTitle = !landscape || state.lyricsVisible)
                }
            }
        }
    }
}

@Composable
private fun RecordPage(state: VinylPlayerState, clock: VinylRotationClock, artwork: AsyncImagePainter,
    landscape: Boolean, drag: LyricStageDrag, motion: Boolean, pulse: Boolean, audio: State<AudioMotion>, phase: State<Double>, onAction: PlayerAction) {
    if (landscape) {
        Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
            Layout(modifier = Modifier.weight(.43f).fillMaxHeight(), content = {
                LandscapeTrackInfo(state, onAction)
                RecordStage(state, clock, artwork, Modifier.fillMaxWidth(), onAction)
            }) { measurables, constraints ->
                val info = measurables[0].measure(constraints.copy(minHeight = 0))
                val insetDifference = (state.topInset - state.bottomInset).dp.toPx()
                // Keep the record's existing size budget; distribute the free space
                // around the complete group instead of placing it all above the title.
                val clearance = maxOf(56.dp.roundToPx(), abs(insetDifference).roundToInt())
                val recordHeight = minOf((constraints.maxWidth * .82f).roundToInt() + 28.dp.roundToPx(),
                    (constraints.maxHeight - info.height - clearance).coerceAtLeast(0))
                val record = measurables[1].measure(constraints.copy(minHeight = recordHeight, maxHeight = recordHeight))
                layout(constraints.maxWidth, constraints.maxHeight) {
                    val freeSpace = (constraints.maxHeight - info.height - record.height).coerceAtLeast(0)
                    val top = ((freeSpace - insetDifference) / 2f).roundToInt().coerceIn(0, freeSpace)
                    info.placeRelative(0, top)
                    record.placeRelative(0, top + info.height)
                }
            }
            Column(Modifier.weight(.57f).fillMaxHeight().padding(top = 56.dp, end = 20.dp, bottom = 4.dp)) {
                ImmersiveLyricStage(state, drag, motion, Modifier.weight(1f), audio, phase,
                    onTap = { onAction("lyrics", 1.0) }, pulseEnabled = pulse)
                PlaybackProgress(state, onAction, compact = true)
                BasicText("${formatPlayerTime(state.position)} / ${formatPlayerTime(state.duration.takeIf { it > 0 } ?: Double.NaN)}",
                    modifier = Modifier.align(Alignment.End).padding(end = 20.dp), style = TextStyle(color = VinylPalette.Muted, fontSize = 10.sp))
                LandscapePlaybackControls(state, onAction)
            }
        }
    } else {
        Column(Modifier.fillMaxSize()) {
            RecordStage(state, clock, artwork, Modifier.weight(1f).fillMaxWidth(), onAction)
            ImmersiveLyricStage(state, drag, motion, Modifier.weight(.70f), audio, phase,
                onTap = { onAction("lyrics", 1.0) }, pulseEnabled = pulse)
            ImmersivePlaybackDock(state, false, onAction = onAction)
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
