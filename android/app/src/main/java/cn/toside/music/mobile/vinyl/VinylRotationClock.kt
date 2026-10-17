package cn.toside.music.mobile.vinyl

/** Pure monotonic clock. Pausing discards elapsed time, never the accumulated angle. */
class VinylRotationClock(initialAngle: Double = 0.0) {
    var angle: Double = initialAngle
        private set
    private var lastFrame: Long? = null

    fun pause() { lastFrame = null }

    fun frame(timeNanos: Long): Float {
        lastFrame?.let { previous ->
            val elapsed = (timeNanos - previous).coerceAtLeast(0L)
            angle = (angle + elapsed / 1_000_000_000.0 * 30.0) % 360.0
        }
        lastFrame = timeNanos
        return angle.toFloat()
    }
}
