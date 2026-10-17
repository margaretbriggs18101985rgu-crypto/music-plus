package cn.toside.music.mobile.vinyl

import androidx.compose.foundation.background
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.dp
import kotlin.math.max
import kotlin.math.min

@Composable
fun PlayerScreen(state: VinylPlayerState, clock: VinylRotationClock = remember { VinylRotationClock() }, onAction: PlayerAction = { _, _ -> }) {
    val drag = remember(state.trackId, state.lyricsVisible) { LyricStageDrag() }
    val motionEnabled = rememberLyricMotionEnabled(remember { ImmersiveVisualConfig() })
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(if (state.lyricsVisible)
        listOf(Color(0xFF191B28), Color(0xFF10111B), Color(0xFF17171E))
        else listOf(VinylPalette.Top, VinylPalette.Middle, VinylPalette.Bottom)))) {
        if (state.lyricsVisible) Canvas(Modifier.fillMaxSize()) {
            val shift = drag.offset.floatValue * .15f
            val far = Offset(size.width * .25f + shift, size.height * .32f)
            val near = Offset(size.width * .85f + shift, size.height * .58f)
            drawCircle(Brush.radialGradient(listOf(Color(0xFF59648D).copy(alpha = .20f), Color.Transparent),
                center = far, radius = size.width * .85f), radius = size.width * .85f, center = far)
            drawCircle(Brush.radialGradient(listOf(Color(0xFF715B79).copy(alpha = .12f), Color.Transparent),
                center = near, radius = size.width * .7f), radius = size.width * .7f, center = near)
        }
        Column(Modifier.fillMaxSize()
            .padding(top = state.topInset.dp, bottom = state.bottomInset.dp)) {
            PlayerTopNavigation(state, onAction)
            if (state.lyricsVisible) {
                ImmersiveLyricStage(state, drag, motionEnabled, Modifier.weight(1f), onAction)
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
                    VinylRecord(state, diameter, clock, Modifier.align(Alignment.BottomCenter).padding(bottom = 18.dp)
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
