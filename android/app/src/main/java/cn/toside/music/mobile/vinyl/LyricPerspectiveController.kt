package cn.toside.music.mobile.vinyl

import kotlin.math.abs
import kotlin.math.pow

/** mineradio pointer sensitivity and 0.90/frame inertia, in logical screen pixels. */
internal data class LyricRotation(val pitch: Float = 0f, val yaw: Float = 0f)
internal data class LyricSpin(val rotation: LyricRotation = LyricRotation(), val pitchSpeed: Float = 0f, val yawSpeed: Float = 0f)
internal fun wrapLyricAngle(degrees: Float): Float =
    if (degrees.isFinite()) ((degrees + 180f) % 360f + 360f) % 360f - 180f else 0f

internal fun rotateLyric(rotation: LyricRotation, x: Float, y: Float): LyricRotation {
    if (!x.isFinite() || !y.isFinite()) return rotation
    return LyricRotation(wrapLyricAngle(rotation.pitch + y * .18335f), wrapLyricAngle(rotation.yaw + x * .19481f))
}

internal fun lyricReleaseSpin(rotation: LyricRotation, xSpeed: Float, ySpeed: Float): LyricSpin {
    fun speed(value: Float, sensitivity: Float) =
        if (value.isFinite()) (value * sensitivity * .46f).coerceIn(-355.2f, 355.2f) else 0f
    return LyricSpin(rotation, speed(ySpeed, .18335f), speed(xSpeed, .19481f))
}

internal fun advanceLyricSpin(spin: LyricSpin, seconds: Float): LyricSpin {
    val dt = if (seconds.isFinite()) seconds.coerceIn(0f, .08f) else 0f
    val decay = .90f.pow(dt * 60f)
    fun remaining(speed: Float) = (speed * decay).let { if (abs(it) < .57f) 0f else it }
    return LyricSpin(LyricRotation(wrapLyricAngle(spin.rotation.pitch + spin.pitchSpeed * dt),
        wrapLyricAngle(spin.rotation.yaw + spin.yawSpeed * dt)), remaining(spin.pitchSpeed), remaining(spin.yawSpeed))
}
