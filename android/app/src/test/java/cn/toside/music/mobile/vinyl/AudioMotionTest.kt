package cn.toside.music.mobile.vinyl

import org.junit.Assert.*
import org.junit.Test

class AudioMotionTest {
    @Test fun respondsQuicklyAndDecaysToSilenceWithoutInventingMotion() {
        assertEquals(AudioMotion(), smoothAudioMotion(AudioMotion(), AudioMotion(), .016f))
        val loud = AudioMotion(1f, .8f, .5f, .3f)
        val attack = smoothAudioMotion(AudioMotion(), loud, .05f)
        assertTrue(attack.energy > .6f)
        assertTrue(attack.bass > attack.mid && attack.mid > attack.treble)
        val release = smoothAudioMotion(loud, AudioMotion(), .05f)
        assertTrue(release.energy > .7f)
        var silence = loud
        repeat(180) { silence = smoothAudioMotion(silence, AudioMotion(), 1f / 60) }
        assertTrue(silence.energy < .00001f)
    }

    @Test fun invalidLevelsAndLongFrameGapsRemainBounded() {
        val levels = smoothAudioMotion(AudioMotion(), AudioMotion(Float.NaN, -1f, 7f, Float.POSITIVE_INFINITY), 9f)
        assertEquals(0f, levels.energy, 0f)
        assertEquals(0f, levels.bass, 0f)
        assertTrue(levels.mid in 0f..1f)
        assertEquals(0f, levels.treble, 0f)
    }
}
