package cn.toside.music.mobile.vinyl

import com.guichaguri.trackplayer.service.player.AudioBands
import org.junit.Assert.*
import org.junit.Test
import kotlin.math.sin

class AudioBandsTest {
    private fun tone(hz: Double): AudioBands {
        val bands = AudioBands(48000)
        repeat(48000) { bands.push(sin(it * 2 * Math.PI * hz / 48000) * .12) }
        return bands
    }
    @Test fun silenceHasNoInventedBeat() {
        val bands = tone(0.0)
        assertEquals(0f, bands.energy, 0f)
        assertEquals(0f, bands.bass + bands.mid + bands.treble, 0f)
    }
    @Test fun realPcmFrequenciesDriveDifferentBands() {
        val bass = tone(70.0)
        val middle = tone(800.0)
        val treble = tone(9000.0)
        assertTrue(bass.bass > bass.mid && bass.bass > bass.treble)
        assertTrue(middle.mid > middle.bass && middle.mid > middle.treble)
        assertTrue(treble.treble > treble.bass && treble.treble > treble.mid)
        assertTrue(bass.energy > 0f && middle.energy > 0f && treble.energy > 0f)
    }
    @Test fun sustainedSilenceClearsAllFrequencyHistory() {
        val bands = tone(70.0)
        repeat(48000) { bands.push(0.0) }
        assertEquals(0f, bands.energy + bands.bass + bands.mid + bands.treble, .00001f)
    }
}
