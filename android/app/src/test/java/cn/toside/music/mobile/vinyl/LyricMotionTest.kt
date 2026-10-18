package cn.toside.music.mobile.vinyl

import org.junit.Assert.*
import org.junit.Test

class LyricMotionTest {
    @Test fun offIsNeutralAndEnabledTextRespondsToTimeAndAudio() {
        assertEquals(0f, lyricTextPulse(1.0, 1f, 1f, false), 0f)
        assertNotEquals(lyricTextPulse(0.0, 0f, 0f, true), lyricTextPulse(.5, 0f, 0f, true))
        assertTrue(lyricTextPulse(.5, .8f, .8f, true) > lyricTextPulse(.5, 0f, 0f, true))
        assertTrue(lyricTextPulse(Double.NaN, Float.NaN, Float.POSITIVE_INFINITY, true).isFinite())
        for (step in 0..200) assertTrue(lyricTextPulse(step / 10.0, 1f, 1f, true) in -.02f.. .07f)
    }
}
