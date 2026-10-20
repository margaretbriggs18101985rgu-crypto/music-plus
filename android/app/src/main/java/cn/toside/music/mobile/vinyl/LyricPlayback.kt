package cn.toside.music.mobile.vinyl

/** Millisecond LRC timestamps become seconds only at the existing seek action boundary. */
internal fun lyricSeekSeconds(timeMs: Double, durationSeconds: Double, hasTrack: Boolean): Double? {
    if (!hasTrack || !timeMs.isFinite() || timeMs < 0 || !durationSeconds.isFinite() || durationSeconds <= 0) return null
    val seconds = timeMs / 1000.0
    return seconds.takeIf { it <= durationSeconds }
}

internal fun lyricSeekAtIndex(lines: List<VinylLyricLine>, index: Int, duration: Double, hasTrack: Boolean): Double? =
    lines.getOrNull(index)?.let { lyricSeekSeconds(it.time, duration, hasTrack) }

/** Resolves the displayed line from player time, matching the lyric parser's 100 ms offset. */
internal fun lyricIndexAtPosition(lines: List<VinylLyricLine>, positionSeconds: Double): Int {
    if (lines.isEmpty() || !positionSeconds.isFinite() || positionSeconds < 0) return -1
    val positionMs = positionSeconds * 1000.0 + 100.0
    var active = -1
    for (index in lines.indices) {
        val time = lines[index].time
        if (time.isFinite() && time <= positionMs) active = index
    }
    return active
}

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
    val line = lines[index]
    if (line.words.isNotEmpty() && line.text.isNotEmpty()) {
        val now = positionSeconds * 1000.0
        var characters = 0.0
        for (word in line.words) {
            if (now < word.startTime) break
            if (now >= word.endTime) characters = word.end.toDouble()
            else {
                characters = word.start + (word.end - word.start) * ((now - word.startTime) / (word.endTime - word.startTime))
                break
            }
        }
        return (characters / line.text.length).toFloat().coerceIn(0f, 1f)
    }
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

// Interpolate only between frequent, player-confirmed samples. A missing sample
// freezes the sweep after 650 ms; pause, buffering and seek use the anchor itself.
internal fun lyricInterpolatedPosition(position: Double, elapsedSeconds: Double, playing: Boolean, rate: Double): Double {
    if (!position.isFinite() || position < 0) return 0.0
    if (!playing || !elapsedSeconds.isFinite() || !rate.isFinite()) return position
    return position + elapsedSeconds.coerceIn(0.0, .65) * rate.coerceIn(.25, 4.0)
}
