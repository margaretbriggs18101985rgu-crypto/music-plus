package cn.toside.music.mobile.vinyl

import org.junit.Assert.*
import org.junit.Test

class LyricViewportTest {
    @Test fun hidingLandscapeControlsExpandsTextAndSpacing() {
        val shown = lyricViewportTypography(840f, 210f, 40f, 1f, true)
        val hidden = lyricViewportTypography(840f, 380f, 40f, 1f, true)
        assertTrue(hidden.fontSp > shown.fontSp * 1.5f)
        assertTrue(hidden.gapDp > shown.gapDp)
        assertTrue(hidden.fontSp * 1.38f * 7 + hidden.gapDp * 6 <= 380.1f)
    }

    @Test fun portraitAndSplitColumnsRespectTheUserSizeAndWidth() {
        val portrait = lyricViewportTypography(340f, 650f, 40f, 1f, true)
        val smallPreference = lyricViewportTypography(340f, 650f, 20f, 1f, true)
        val narrow = lyricViewportTypography(240f, 650f, 40f, 1f, true)
        assertTrue(portrait.fontSp > narrow.fontSp)
        assertEquals(20f, smallPreference.fontSp, .001f)
        assertTrue(narrow.fontSp * 9 <= 240.1f)
    }

    @Test fun sizesChangeContinuouslyWhenInsetsChange() {
        for (height in 160..700) {
            val a = lyricViewportTypography(840f, height.toFloat(), 40f, 1f, true)
            val b = lyricViewportTypography(840f, height + 1f, 40f, 1f, true)
            assertTrue(b.fontSp >= a.fontSp && b.fontSp - a.fontSp < .1f)
            assertTrue(b.gapDp >= a.gapDp && b.gapDp - a.gapDp < .2f)
        }
    }

    @Test fun systemFontScalingFitsTheAvailableSpace() {
        val normal = lyricViewportTypography(340f, 380f, 40f, 1f, true)
        val large = lyricViewportTypography(340f, 380f, 40f, 1.5f, true)
        assertEquals(normal.fontSp, large.fontSp * 1.5f, .001f)
        assertTrue(large.translationSp >= 10f)
    }

    @Test fun singleLineGrowsWithHeightAndHasFiniteBounds() {
        val shown = lyricViewportTypography(840f, 180f, 40f, 1f, false)
        val hidden = lyricViewportTypography(840f, 380f, 40f, 1f, false)
        assertTrue(hidden.fontSp > shown.fontSp)
        val tiny = lyricViewportTypography(0f, 0f, 40f, 1f, true)
        assertTrue(tiny.fontSp.isFinite() && tiny.gapDp.isFinite())
    }
}
