package cn.toside.music.mobile.vinyl

/** Millisecond LRC timestamps become seconds only at the existing seek action boundary. */
internal fun lyricSeekSeconds(timeMs: Double, durationSeconds: Double, hasTrack: Boolean): Double? {
    if (!hasTrack || !timeMs.isFinite() || timeMs < 0 || !durationSeconds.isFinite() || durationSeconds <= 0) return null
    val seconds = timeMs / 1000.0
    return seconds.takeIf { it <= durationSeconds }
}

internal fun lyricSeekAtIndex(lines: List<VinylLyricLine>, index: Int, duration: Double, hasTrack: Boolean): Double? =
    lines.getOrNull(index)?.let { lyricSeekSeconds(it.time, duration, hasTrack) }
