package cn.toside.music.mobile.vinyl

import android.util.Log
import androidx.compose.runtime.*
import com.guichaguri.trackplayer.service.player.ReactiveAudio
import cn.toside.music.mobile.BuildConfig
import kotlin.math.exp
import kotlin.math.sin
import kotlin.math.cos

internal data class AudioMotion(val energy: Float = 0f, val bass: Float = 0f, val mid: Float = 0f, val treble: Float = 0f,
    val beat: Float = 0f, val beatSerial: Long = 0L, val spectrum: List<Float> = emptyList(),
    val available: Boolean = false, val lowHz: Float = 45f, val highHz: Float = 170f,
    val orbitYaw: Float = 0f, val orbitPitch: Float = 0f)

internal fun smoothAudioMotion(previous: AudioMotion, next: AudioMotion, seconds: Float): AudioMotion {
    fun smooth(from: Float, to: Float): Float {
        val target = if (to.isFinite()) to.coerceIn(0f, 1f) else 0f
        val amount = 1f - exp(-seconds.coerceIn(0f, .1f) / if (target > from) .045f else .20f)
        return from + (target - from) * amount
    }
    // A path advances only on observed onsets; its slow response separates lens travel from beat emphasis.
    val orbit = if (next.available && next.beatSerial > 0) next.energy.coerceIn(0f, 1f) else 0f
    val follow = 1f - exp(-seconds.coerceIn(0f, .1f) / .38f)
    val yaw = sin(next.beatSerial * .53).toFloat() * orbit
    val pitch = cos(next.beatSerial * .37).toFloat() * orbit
    return AudioMotion(smooth(previous.energy, next.energy), smooth(previous.bass, next.bass),
        smooth(previous.mid, next.mid), smooth(previous.treble, next.treble),
        smooth(previous.beat, next.beat), next.beatSerial,
        next.spectrum.mapIndexed { index, value -> smooth(previous.spectrum.getOrElse(index) { 0f }, value) },
        next.available, next.lowHz, next.highHz,
        previous.orbitYaw + (yaw - previous.orbitYaw) * follow,
        previous.orbitPitch + (pitch - previous.orbitPitch) * follow)
}

@Composable
internal fun rememberAudioMotion(trackId: String, enabled: Boolean, playing: Boolean,
    settings: ReactiveVisuals = ReactiveVisuals(), seekRevision: Int = 0): State<AudioMotion> {
    val motion = remember(trackId, seekRevision) { mutableStateOf(AudioMotion()) }
    DisposableEffect(trackId, seekRevision, enabled, settings.kickAuto, settings.kickLowHz, settings.kickHighHz, settings.kickSensitivity) {
        if (enabled) {
            ReactiveAudio.configure(settings.kickAuto, settings.kickLowHz, settings.kickHighHz, settings.kickSensitivity)
            ReactiveAudio.resetAnalysis()
            ReactiveAudio.acquire()
        }
        onDispose { if (enabled) ReactiveAudio.release() }
    }
    LaunchedEffect(trackId, seekRevision, enabled, playing) {
        motion.value = AudioMotion()
        if (!enabled || !playing) return@LaunchedEffect
        var previous = withFrameNanos { it }
        var lastLog = 0L
        while (true) withFrameNanos { now ->
            val frame = ReactiveAudio.frame()
            val target = if (frame.positionUs != Long.MIN_VALUE)
                AudioMotion(frame.energy, frame.bass, frame.mid, frame.treble, frame.beat, frame.beatSerial,
                    frame.spectrum.toList(), true, frame.lowHz, frame.highHz) else AudioMotion()
            motion.value = smoothAudioMotion(motion.value, target, (now - previous) / 1_000_000_000f)
            if (BuildConfig.DEBUG && now - lastLog > 2_000_000_000L) {
                Log.d("MusicPlusAudio", "energy=${target.energy} bass=${target.bass} mid=${target.mid} treble=${target.treble} kick=${target.beat} beats=${target.beatSerial} available=${target.available} hz=${target.lowHz}-${target.highHz} lagUs=${frame.positionUs}")
                lastLog = now
            }
            previous = now
        }
    }
    return motion
}
