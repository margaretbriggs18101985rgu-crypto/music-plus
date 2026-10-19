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

    @Test fun realKickOnsetsFollowTempoAndDoNotContinueThroughSilence() {
        for (rate in listOf(44100, 48000, 96000)) {
            for (bpm in listOf(80, 120, 160)) {
                val bands = AudioBands(rate)
                val period = 60.0 / bpm
                val hits = mutableListOf<Double>()
                var previous = 0L
                repeat(rate * 8) { i ->
                    val t = i.toDouble() / rate
                    val phase = (t + period - .3) % period
                    val kick = if (phase < .13) sin(2 * Math.PI * 65 * phase) * .55 * kotlin.math.exp(-phase * 32) else 0.0
                    if (bands.push(kick + sin(2 * Math.PI * 850 * t) * .035) && bands.beatSerial != previous) {
                        hits.add(t); previous = bands.beatSerial
                    }
                }
                assertTrue("rate=$rate bpm=$bpm hits=$hits", hits.size >= (7.3 / period).toInt() - 1)
                assertTrue("No doubled beats: $hits", hits.zipWithNext().all { (a, b) -> kotlin.math.abs(b - a - period) < .07 })
                val finalBeat = bands.beatSerial
                repeat(rate) { bands.push(0.0) }
                assertEquals(finalBeat, bands.beatSerial)
                assertEquals(0f, bands.energy, 0f)
                assertTrue(bands.beat < .01f)
                assertTrue(bands.spectrum.all { it == 0f })
            }
        }
    }

    @Test fun sustainedBassAndHighFrequencyTransientsDoNotManufactureKicks() {
        for (hz in listOf(65.0, 1200.0, 8000.0)) {
            val bands = AudioBands(48000)
            repeat(48000 * 4) { i ->
                val t = i / 48000.0
                val amplitude = if (hz == 65.0) .2 else if (t % .5 < .1) .4 else 0.0
                bands.push(sin(2 * Math.PI * hz * t) * amplitude)
            }
            assertEquals("hz=$hz", 0L, bands.beatSerial)
        }
    }

    @Test fun stereoPhaseInversionDoesNotEraseRealAudioAndSpectrumLocatesTheTone() {
        val mono = AudioBands(48000)
        val stereo = AudioBands(48000)
        repeat(48000) { i ->
            val value = sin(2 * Math.PI * 1000 * i / 48000) * .12
            mono.push(value); stereo.push(value, -value)
        }
        assertEquals(mono.energy, stereo.energy, .0001f)
        assertTrue(stereo.mid > stereo.bass && stereo.mid > stereo.treble)
        val peak = stereo.spectrum.indices.maxBy { stereo.spectrum[it] }
        val peakHz = 30 * Math.pow(16000.0 / 30, (peak + .5) / 32)
        assertTrue("peak=$peakHz", peakHz in 800.0..1200.0)
    }

    @Test fun manuallySelectedKickWindowActuallyChangesWhichTransientsAreAccepted() {
        val matching = AudioBands(48000).apply { configure(false, 110.0, 300.0, 1.0) }
        val excluded = AudioBands(48000).apply { configure(false, 40.0, 120.0, 1.0) }
        repeat(48000 * 5) { i ->
            val t = i / 48000.0
            val phase = t % .5
            // A smooth narrow-band burst isolates the chosen frequency; a hard attack is broadband.
            val envelope = if (phase < .22) sin(Math.PI * phase / .22).let { it * it } else 0.0
            val kick = sin(2 * Math.PI * 250 * phase) * .4 * envelope
            matching.push(kick); excluded.push(kick)
        }
        assertTrue(matching.beatSerial >= 8)
        assertTrue("matching=${matching.beatSerial} excluded=${excluded.beatSerial}", excluded.beatSerial < matching.beatSerial / 2)
        assertEquals(110f, matching.detectedLowHz, 0f)
        assertEquals(120f, excluded.detectedHighHz, 0f)
    }
}
