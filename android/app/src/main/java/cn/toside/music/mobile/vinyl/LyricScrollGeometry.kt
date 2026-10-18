package cn.toside.music.mobile.vinyl

import kotlin.math.floor

internal fun lyricScrollWindow(cursor: Float, count: Int): IntRange {
    if (count <= 0) return IntRange.EMPTY
    val center = floor(if (cursor.isFinite()) cursor else 0f).toInt().coerceIn(0, count - 1)
    return (center - 4).coerceAtLeast(0)..(center + 4).coerceAtMost(count - 1)
}

internal fun lyricRowCenters(heights: IntArray, gap: Float): FloatArray {
    var top = 0f
    return FloatArray(heights.size) { index ->
        val height = heights[index].coerceAtLeast(0)
        val center = top + height / 2f
        top += height + gap
        center
    }
}

/** Interpolate measured centers, including wrapped lines and their translations. */
internal fun lyricCameraCenter(cursor: Float, firstIndex: Int, centers: FloatArray): Float {
    if (centers.isEmpty()) return 0f
    val local = (if (cursor.isFinite()) cursor else firstIndex.toFloat()) - firstIndex
    val lower = floor(local).toInt().coerceIn(0, centers.lastIndex)
    val upper = (lower + 1).coerceAtMost(centers.lastIndex)
    if (local < 0f) return centers.first() + local * ((centers.getOrNull(1) ?: (centers[0] + 80f)) - centers[0])
    return centers[lower] + (centers[upper] - centers[lower]) * (local - lower).coerceIn(0f, 1f)
}
