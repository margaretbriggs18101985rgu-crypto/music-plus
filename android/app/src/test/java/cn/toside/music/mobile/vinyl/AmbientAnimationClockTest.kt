package cn.toside.music.mobile.vinyl

import org.junit.Assert.*
import org.junit.Test

class AmbientAnimationClockTest {
    @Test fun pauseRetainsPhaseAndExcludesBackgroundTime() {
        val clock = AmbientAnimationClock()
        clock.frame(0); clock.frame(20_000_000)
        clock.pause()
        assertEquals(.02, clock.frame(600_000_000_000), .000001)
        assertEquals(.04, clock.frame(600_020_000_000), .000001)
    }
    @Test fun stallsAreCappedAndBackwardFramesCannotReverseTime() {
        val clock = AmbientAnimationClock()
        clock.frame(1_000_000_000)
        assertEquals(.05, clock.frame(5_000_000_000), .000001)
        assertEquals(.05, clock.frame(4_000_000_000), .000001)
    }
    @Test fun normalFramesAccumulateWithoutDependingOnAudioPosition() {
        val clock = AmbientAnimationClock()
        repeat(61) { clock.frame(it * 16_666_667L) }
        assertEquals(1.0, clock.seconds, .000001)
    }
}
