package cn.toside.music.mobile.vinyl

import org.junit.Assert.*
import org.junit.Test

class ImmersiveVisualConfigTest {
    private val config = ImmersiveVisualConfig()
    private val foreground = ImmersiveEnvironment(foreground = true)
    @Test fun oldBridgeStateGetsTheExistingEnabledDefaults() {
        assertEquals(config, visualConfigForState(VinylPlayerState()))
        assertEquals(ParticleQuality.Auto, visualConfigForState(VinylPlayerState(particleQuality = "unknown")).particleQuality)
    }
    @Test fun persistedValuesControlIndependentNativeEffects() {
        val mapped = visualConfigForState(VinylPlayerState(immersiveVisualsEnabled = false,
            lyricMotionEnabled = false, backgroundMotion = false, respectReducedMotion = false, particleQuality = "high"))
        assertEquals(ImmersiveVisualConfig(false, false, false, false, ParticleQuality.High), mapped)
        assertEquals(AmbientPolicy(false, 0, false, false), resolveAmbientPolicy(mapped, foreground, true))
        for ((wire, expected) in listOf("low" to ParticleQuality.Low, "off" to ParticleQuality.Off)) {
            assertEquals(expected, visualConfigForState(VinylPlayerState(particleQuality = wire)).particleQuality)
        }
    }
    @Test fun explicitQualityIsRespectedAndOnlyAutoAdaptsToLowRam() {
        for ((quality, count) in listOf(ParticleQuality.Auto to 3600, ParticleQuality.Low to 1200,
            ParticleQuality.High to 6400, ParticleQuality.Off to 0)) {
            assertEquals(count, resolveAmbientPolicy(config.copy(particleQuality = quality), foreground, true).particleCount)
        }
        assertEquals(6400, resolveAmbientPolicy(config.copy(particleQuality = ParticleQuality.High), foreground.copy(lowRam = true), true).particleCount)
        assertEquals(1200, resolveAmbientPolicy(config, foreground.copy(lowRam = true), true).particleCount)
    }
    @Test fun invisiblePowerSaveOrReducedMotionStopsAllEffects() {
        for (environment in listOf(foreground.copy(foreground = false), foreground.copy(powerSave = true), foreground.copy(systemMotion = false))) {
            assertEquals(AmbientPolicy(false, 0, false, false), resolveAmbientPolicy(config, environment, true))
        }
        assertEquals(AmbientPolicy(false, 0, false, false), resolveAmbientPolicy(config.copy(visualEffectsEnabled = false), foreground, true))
    }
    @Test fun absentStageDoesNotRunAmbientLoopOrParticles() {
        val policy = resolveAmbientPolicy(config, foreground, false)
        assertFalse(policy.animate); assertEquals(0, policy.particleCount)
    }
    @Test fun independentSwitchesAndReducedMotionOverrideAreReal() {
        val policy = resolveAmbientPolicy(config.copy(backgroundMotion = false, lyricMotionEnabled = false), foreground, true)
        assertFalse(policy.animate); assertFalse(policy.lyricMotion); assertEquals(3600, policy.particleCount)
        assertTrue(resolveAmbientPolicy(config.copy(respectReducedMotion = false), foreground.copy(systemMotion = false), true).animate)
    }

    @Test fun lyricAndStarRhythmCanBeDisabledIndependentlyWithoutStoppingTransitionsOrDrift() {
        for (lyric in listOf(true, false)) for (star in listOf(true, false)) {
            val mapped = visualConfigForState(VinylPlayerState(lyricPulseEnabled = lyric, starPulseEnabled = star))
            val policy = resolveAmbientPolicy(mapped, foreground, true)
            assertEquals(lyric, policy.lyricPulse)
            assertEquals(star, policy.starPulse)
            assertTrue(policy.lyricMotion)
            assertTrue(policy.animate)
            assertEquals(3600, policy.particleCount)
        }
    }
}
