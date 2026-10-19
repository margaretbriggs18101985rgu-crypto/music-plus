package cn.toside.music.mobile.vinyl

internal data class LyricViewportTypography(val fontSp: Float, val gapDp: Float) {
    val translationSp: Float get() = (fontSp * .52f).coerceIn(10f, 22f)
}

/** Sizes use the unobscured viewport and the user's preferred font size. */
internal fun lyricViewportTypography(widthDp: Float, heightDp: Float, preferredFontSp: Float,
    fontScale: Float, multiple: Boolean): LyricViewportTypography {
    val scale = fontScale.coerceAtLeast(.5f)
    val width = widthDp.coerceAtLeast(1f)
    val height = heightDp.coerceAtLeast(1f)
    val preferred = preferredFontSp.coerceIn(12f, 80f)
    val font = if (multiple) {
        // About seven ordinary rows; wrapped/translated rows retain their measured height.
        minOf(preferred, width / (9f * scale), height / (12f * scale)).coerceAtLeast(12f)
    } else minOf(preferred * (height / 240f).coerceIn(.7f, 1.2f), width / (7f * scale)).coerceAtLeast(12f)
    val gap = if (multiple) ((height - 7f * font * scale * 1.38f) / 6f).coerceIn(4f, 24f) else 0f
    return LyricViewportTypography(font, gap)
}
