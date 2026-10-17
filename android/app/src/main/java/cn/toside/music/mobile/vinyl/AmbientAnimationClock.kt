package cn.toside.music.mobile.vinyl

/** Visual time only; never used for audio position or active lyrics. */
internal class AmbientAnimationClock {
    var seconds = 0.0
        private set
    private var lastFrame: Long? = null
    fun pause() { lastFrame = null }
    fun frame(timeNanos: Long): Double {
        lastFrame?.let { previous -> seconds += ((timeNanos - previous).coerceAtLeast(0L) / 1_000_000_000.0).coerceAtMost(.05) }
        lastFrame = timeNanos
        return seconds
    }
}
