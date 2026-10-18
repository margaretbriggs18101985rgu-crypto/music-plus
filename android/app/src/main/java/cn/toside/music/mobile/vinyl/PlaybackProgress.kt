package cn.toside.music.mobile.vinyl

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale

internal fun formatPlayerTime(seconds: Double): String {
    if (!seconds.isFinite() || seconds < 0) return "--:--"
    val value = seconds.toLong()
    return String.format(Locale.ROOT, "%02d:%02d", value / 60, value % 60)
}

@Composable
internal fun PlaybackProgress(state: VinylPlayerState, onAction: PlayerAction, compact: Boolean = false) {
    val duration = state.duration.takeIf { it.isFinite() && it > 0 } ?: 0.0
    val actual = if (duration > 0) (state.position / duration).toFloat().coerceIn(0f, 1f) else 0f
    var dragging by remember { mutableStateOf(false) }
    var preview by remember { mutableFloatStateOf(0f) }
    var width by remember { mutableFloatStateOf(1f) }
    val progress = if (dragging) preview else actual
    val currentAction by rememberUpdatedState(onAction)
    val enabled = state.hasTrack && duration > 0
    // A new track cancels an in-progress scrub; regular position updates do not.
    LaunchedEffect(state.trackId) { dragging = false }
    val insetPx = with(LocalDensity.current) { 4.dp.toPx() }
    fun ratio(x: Float) = ((x - insetPx) / (width - insetPx * 2).coerceAtLeast(1f)).coerceIn(0f, 1f)
    Column(Modifier.fillMaxWidth().padding(horizontal = if (compact) 16.dp else 27.dp)) {
        Canvas(Modifier.fillMaxWidth().height(if (compact) 24.dp else 44.dp).onSizeChanged { width = it.width.toFloat() }
            .semantics {
                contentDescription = "播放进度"
                progressBarRangeInfo = ProgressBarRangeInfo(progress, 0f..1f)
                if (enabled) setProgress { value -> currentAction("seek", value.coerceIn(0f, 1f) * duration); true }
            }
            .pointerInput(enabled, state.trackId, duration, insetPx) {
                // One recognizer owns both tap and scrub. Consume the down event
                // before the dock's empty-space click handler can claim the gesture.
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    down.consume()
                    var target = ratio(down.position.x)
                    try {
                        while (true) {
                            val event = awaitPointerEvent()
                            val change = event.changes.firstOrNull { it.id == down.id } ?: break
                            if (event.changes.count { it.pressed } > 1) break
                            if (!change.pressed) {
                                change.consume()
                                if (enabled) currentAction("seek", target * duration)
                                break
                            }
                            if (enabled && (dragging || (change.position - down.position).getDistance() > viewConfiguration.touchSlop)) {
                                dragging = true
                                target = ratio(change.position.x)
                                preview = target
                            }
                            change.consume()
                        }
                    } finally { dragging = false }
                }
            }) {
            val inset = 4.dp.toPx()
            val y = size.height / 2
            val end = size.width - inset
            drawLine(VinylPalette.Muted.copy(alpha = .38f), Offset(inset, y), Offset(end, y), 1.8.dp.toPx())
            drawLine(VinylPalette.White, Offset(inset, y), Offset(inset + (end - inset) * progress, y), 1.8.dp.toPx())
            if (!compact || dragging) drawCircle(VinylPalette.White, if (dragging) 4.5.dp.toPx() else 3.dp.toPx(), Offset(inset + (end - inset) * progress, y))
        }
        if (!compact) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            BasicText(if (state.hasTrack) formatPlayerTime(if (dragging) preview * duration else state.position) else "--:--",
                style = TextStyle(color = VinylPalette.Muted, fontSize = 11.sp))
            BasicText(if (state.demo) "界面演示 · 无音频" else state.status,
                modifier = Modifier.weight(1f).padding(horizontal = 10.dp), maxLines = 1,
                style = TextStyle(color = VinylPalette.Muted, fontSize = 11.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center))
            BasicText(if (duration > 0) formatPlayerTime(duration) else "--:--",
                style = TextStyle(color = VinylPalette.Muted, fontSize = 11.sp))
        }
    }
}
