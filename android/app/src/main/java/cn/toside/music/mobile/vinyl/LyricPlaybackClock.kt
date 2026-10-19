package cn.toside.music.mobile.vinyl

import android.os.SystemClock
import androidx.compose.runtime.*

@Composable
internal fun rememberLyricPlaybackPosition(state: VinylPlayerState): State<Double> {
    val position = remember(state.trackId) { mutableDoubleStateOf(state.position) }
    LaunchedEffect(state.trackId, state.position, state.isPlaying, state.playbackRate, state.seekRevision) {
        position.doubleValue = state.position
        if (!state.isPlaying) return@LaunchedEffect
        val anchor = SystemClock.elapsedRealtimeNanos()
        while (true) withFrameNanos {
            position.doubleValue = lyricInterpolatedPosition(state.position,
                (SystemClock.elapsedRealtimeNanos() - anchor) / 1_000_000_000.0, true, state.playbackRate)
        }
    }
    return position
}
