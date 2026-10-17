package cn.toside.music.mobile.vinyl

import org.junit.Assert.*
import org.junit.Test

class LyricAppearanceTest {
    @Test fun savedColorBecomesOpaqueAndInvalidBridgeValuesHaveASafeFallback() {
        assertEquals(0xFFFF9FCFL, lyricColorArgb("#ff9fcf"))
        assertEquals(0xFFFFFFFFL, lyricColorArgb("#FFFFFF"))
        for (value in listOf("", "#GGGGGG", "#00000000", "red", "#FFF")) {
            assertEquals(0xFFA8F6FFL, lyricColorArgb(value))
        }
    }
    @Test fun multiLineWindowFollowsTheAudioAndHandlesTrackBoundaries() {
        assertEquals(listOf(8, 9, 10, 11, 12), visibleLyricIndices(10, 30))
        assertEquals(listOf(0, 1, 2), visibleLyricIndices(0, 30))
        assertEquals(listOf(27, 28, 29), visibleLyricIndices(29, 30))
        assertEquals(listOf(0), visibleLyricIndices(0, 1))
        assertTrue(visibleLyricIndices(-1, 0).isEmpty())
    }
}
