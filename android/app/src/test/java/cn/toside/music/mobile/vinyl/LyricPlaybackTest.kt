package cn.toside.music.mobile.vinyl

import org.junit.Assert.*
import org.junit.Test

class LyricPlaybackTest {
    @Test fun millisecondsBecomeSecondsIncludingFractionalTimes() {
        assertEquals(21.838, lyricSeekSeconds(21838.0, 212.0, true)!!, .000001)
        assertEquals(0.0, lyricSeekSeconds(0.0, 212.0, true)!!, 0.0)
        assertEquals(212.0, lyricSeekSeconds(212000.0, 212.0, true)!!, 0.0)
    }
    @Test fun malformedAndOutOfRangeDataCannotSeek() {
        for (time in listOf(-1.0, Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY, 213000.0)) {
            assertNull(lyricSeekSeconds(time, 212.0, true))
        }
        for (duration in listOf(0.0, -1.0, Double.NaN, Double.POSITIVE_INFINITY)) {
            assertNull(lyricSeekSeconds(1000.0, duration, true))
        }
        assertNull(lyricSeekSeconds(1000.0, 212.0, false))
    }
    @Test fun emptySingleLineAndBadIndicesAreSafe() {
        assertNull(lyricSeekAtIndex(emptyList(), 0, 212.0, true))
        val lines = listOf(VinylLyricLine(1500.0, "单句"))
        assertNull(lyricSeekAtIndex(lines, -1, 212.0, true))
        assertNull(lyricSeekAtIndex(lines, 1, 212.0, true))
        assertEquals(1.5, lyricSeekAtIndex(lines, 0, 212.0, true)!!, 0.0)
    }
    @Test fun duplicateTimesAndLongTranslationsPreserveIndicesAndTime() {
        val lines = listOf(VinylLyricLine(Double.NaN, "无效时间"),
            VinylLyricLine(12000.0, "first", "长译文\n".repeat(200)), VinylLyricLine(12000.0, "second"))
        assertNull(lyricSeekAtIndex(lines, 0, 212.0, true))
        assertEquals(12.0, lyricSeekAtIndex(lines, 1, 212.0, true)!!, 0.0)
        assertEquals(12.0, lyricSeekAtIndex(lines, 2, 212.0, true)!!, 0.0)
        assertEquals("second", lines[2].text)
    }
}
