package cn.toside.music.mobile.vinyl

import android.os.SystemClock
import android.util.Log
import androidx.compose.runtime.*
import com.guichaguri.trackplayer.service.player.ReactiveAudio
import cn.toside.music.mobile.BuildConfig
import kotlin.math.exp

internal data class AudioMotion(val energy: Float = 0f, val bass: Float = 0f, val mid: Float = 0f, val treble: Float = 0f)

internal fun smoothAudioMotion(previous: AudioMotion, next: AudioMotion, seconds: Float): AudioMotion {
    fun smooth(from: Float, to: Float): Float {
        val target = if (to.isFinite()) to.coerceIn(0f, 1f) else 0f
        val amount = 1f - exp(-seconds.coerceIn(0f, .1f) / if (target > from) .045f else .20f)
        return from + (target - from) * amount
    }
    return AudioMotion(smooth(previous.energy, next.energy), smooth(previous.bass, next.bass),
        smooth(previous.mid, next.mid), smooth(previous.treble, next.treble))
}

@Composable
internal fun rememberAudioMotion(trackId: String, enabled: Boolean, playing: Boolean): State<AudioMotion> {
    val motion = remember(trackId) { mutableStateOf(AudioMotion()) }
    DisposableEffect(enabled) {
        if (enabled) ReactiveAudio.acquire()
        onDispose { if (enabled) ReactiveAudio.release() }
    }
    LaunchedEffect(trackId, enabled, playing) {
        motion.value = AudioMotion()
        if (!enabled || !playing) return@LaunchedEffect
        var previous = withFrameNanos { it }
        var lastLog = 0L
        while (true) withFrameNanos { now ->
            val frame = ReactiveAudio.frame()
            val target = if (SystemClock.elapsedRealtime() - frame.at in 0..250)
                AudioMotion(frame.energy, frame.bass, frame.mid, frame.treble) else AudioMotion()
            motion.value = smoothAudioMotion(motion.value, target, (now - previous) / 1_000_000_000f)
            if (BuildConfig.DEBUG && now - lastLog > 2_000_000_000L) {
                Log.d("MusicPlusAudio", "energy=${target.energy} bass=${target.bass} mid=${target.mid} treble=${target.treble}")
                lastLog = now
            }
            previous = now
        }
    }
    return motion
}
