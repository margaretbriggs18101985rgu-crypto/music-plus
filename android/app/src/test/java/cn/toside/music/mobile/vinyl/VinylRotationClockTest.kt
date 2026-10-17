package cn.toside.music.mobile.vinyl

import org.junit.Assert.assertEquals
import org.junit.Test

class VinylRotationClockTest {
    @Test fun twelveSecondsIsOneClockwiseTurn() {
        val clock = VinylRotationClock()
        clock.frame(0L)
        assertEquals(90f, clock.frame(3_000_000_000L), .001f)
        assertEquals(0f, clock.frame(12_000_000_000L), .001f)
    }
    @Test fun pauseRetainsAngleAndResumeExcludesPausedTime() {
        val clock = VinylRotationClock()
        clock.frame(0L)
        clock.frame(2_000_000_000L)
        clock.pause()
        assertEquals(60.0, clock.angle, .001)
        assertEquals(60f, clock.frame(90_000_000_000L), .001f)
        assertEquals(90f, clock.frame(91_000_000_000L), .001f)
    }
    @Test fun retainedClockContinuesAcrossMultiplePauseResumeCycles() {
        val clock = VinylRotationClock(123.0)
        clock.frame(0L)
        clock.frame(1_000_000_000L)
        clock.pause()
        clock.pause()
        assertEquals(153f, clock.frame(50_000_000_000L), .001f)
        assertEquals(183f, clock.frame(51_000_000_000L), .001f)
    }
}
