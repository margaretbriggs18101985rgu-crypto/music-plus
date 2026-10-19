package cn.toside.music.mobile.vinyl

/** Millisecond LRC timestamps become seconds only at the existing seek action boundary. */
internal fun lyricSeekSeconds(timeMs: Double, durationSeconds: Double, hasTrack: Boolean): Double? {
    if (!hasTrack || !timeMs.isFinite() || timeMs < 0 || !durationSeconds.isFinite() || durationSeconds <= 0) return null
    val seconds = timeMs / 1000.0
    return seconds.takeIf { it <= durationSeconds }
}

internal fun lyricSeekAtIndex(lines: List<VinylLyricLine>, index: Int, duration: Double, hasTrack: Boolean): Double? =
    lines.getOrNull(index)?.let { lyricSeekSeconds(it.time, duration, hasTrack) }

/**
 * Returns the fraction of a lyric line highlighted from left to right.
 * LRC timestamps are milliseconds; playback position and duration are seconds.
 */
internal fun lyricHighlightProgress(
    lines: List<VinylLyricLine>,
    index: Int,
    positionSeconds: Double,
    durationSeconds: Double,
    activeIndex: Int,
): Float {
    if (index !in lines.indices || !positionSeconds.isFinite() || positionSeconds < 0 ||
        activeIndex !in lines.indices) return 0f
    if (index < activeIndex) return 1f
    if (index > activeIndex) return 0f

    val start = lines[index].time
    if (!start.isFinite() || start < 0) return 0f
    val end = lines.asSequence().drop(index + 1)
        .map { it.time }
        .firstOrNull { it.isFinite() && it > start }
        ?: if (durationSeconds.isFinite() && durationSeconds * 1000.0 > start) durationSeconds * 1000.0 else return 0f
    if (end <= start) return 0f
    return (((positionSeconds * 1000.0 - start) / (end - start)).toFloat()).coerceIn(0f, 1f)
}
