package cn.toside.music.mobile.vinyl

internal fun lyricColorArgb(value: String): Long =
    if (Regex("^#[0-9a-fA-F]{6}$").matches(value)) 0xFF000000L or value.substring(1).toLong(16) else 0xFFA8F6FFL

internal fun visibleLyricIndices(active: Int, count: Int): List<Int> =
    if (count <= 0 || active !in 0 until count) emptyList() else ((active - 2).coerceAtLeast(0)..(active + 2).coerceAtMost(count - 1)).toList()
