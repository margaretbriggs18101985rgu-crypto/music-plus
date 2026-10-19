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

    @Test fun lyricHighlightFollowsActualLineWindow() {
        val lines = listOf(VinylLyricLine(10_000.0, "first"), VinylLyricLine(14_000.0, "second"), VinylLyricLine(20_000.0, "last"))
        assertEquals(0f, lyricHighlightProgress(lines, 0, 9.5, 30.0, 0), 0f)
        assertEquals(.5f, lyricHighlightProgress(lines, 0, 12.0, 30.0, 0), .0001f)
        assertEquals(1f, lyricHighlightProgress(lines, 0, 14.0, 30.0, 1), 0f)
        assertEquals(0f, lyricHighlightProgress(lines, 2, 15.0, 30.0, 1), 0f)
        assertEquals(1f / 3f, lyricHighlightProgress(lines, 2, 23.333333, 30.0, 2), .0001f)
    }

    @Test fun lyricHighlightUsesDurationForFinalLineAndRejectsBadTimes() {
        val lines = listOf(VinylLyricLine(10_000.0, "last"))
        assertEquals(.5f, lyricHighlightProgress(lines, 0, 20.0, 30.0, 0), .0001f)
        assertEquals(0f, lyricHighlightProgress(lines, 0, 20.0, Double.NaN, 0), 0f)
        assertEquals(0f, lyricHighlightProgress(lines, 0, Double.NaN, 30.0, 0), 0f)
        assertEquals(0f, lyricHighlightProgress(lines, 0, 20.0, 30.0, -1), 0f)
    }

    @Test fun wordTimingPreservesVocalPausesAndFillsOnlyTheSungCharacters() {
        val lines = listOf(VinylLyricLine(10_000.0, "铁盒的钥匙我找不到", words = listOf(
            VinylLyricWord(0, 2, 10_000.0, 11_000.0), VinylLyricWord(2, 5, 12_000.0, 13_500.0),
            VinylLyricWord(5, 9, 14_000.0, 16_000.0))))
        assertEquals(1f / 9f, lyricHighlightProgress(lines, 0, 10.5, 30.0, 0), .0001f)
        assertEquals(2f / 9f, lyricHighlightProgress(lines, 0, 11.8, 30.0, 0), .0001f)
        assertEquals(3.5f / 9f, lyricHighlightProgress(lines, 0, 12.75, 30.0, 0), .0001f)
        assertEquals(1f, lyricHighlightProgress(lines, 0, 16.0, 30.0, 0), 0f)
        assertEquals(0f, lyricHighlightProgress(lines, 0, 9.0, 30.0, 0), 0f)
    }

    @Test fun displayInterpolationStopsAtTheNextMissingSampleAndHonorsPauseAndRate() {
        assertEquals(12.25, lyricInterpolatedPosition(12.0, .25, true, 1.0), 0.0)
        assertEquals(12.5, lyricInterpolatedPosition(12.0, .25, true, 2.0), 0.0)
        assertEquals(12.65, lyricInterpolatedPosition(12.0, 10.0, true, 1.0), .00001)
        assertEquals(12.0, lyricInterpolatedPosition(12.0, .25, false, 1.0), 0.0)
        assertEquals(3.0, lyricInterpolatedPosition(3.0, 0.0, true, 1.0), 0.0)
    }
}
