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
    @Test fun qualityUsesBoundedCountsAndLowRamCapsHigh() {
        for ((quality, count) in listOf(ParticleQuality.Auto to 32, ParticleQuality.Low to 16,
            ParticleQuality.High to 42, ParticleQuality.Off to 0)) {
            assertEquals(count, resolveAmbientPolicy(config.copy(particleQuality = quality), foreground, true).particleCount)
        }
        assertEquals(16, resolveAmbientPolicy(config.copy(particleQuality = ParticleQuality.High), foreground.copy(lowRam = true), true).particleCount)
    }
    @Test fun invisiblePowerSaveOrReducedMotionStopsAllEffects() {
        for (environment in listOf(foreground.copy(foreground = false), foreground.copy(powerSave = true), foreground.copy(systemMotion = false))) {
            assertEquals(AmbientPolicy(false, 0, false, false), resolveAmbientPolicy(config, environment, true))
        }
        assertEquals(AmbientPolicy(false, 0, false, false), resolveAmbientPolicy(config.copy(visualEffectsEnabled = false), foreground, true))
    }
    @Test fun vinylDoesNotRunAmbientLoopOrParticles() {
        val policy = resolveAmbientPolicy(config, foreground, false)
        assertFalse(policy.animate); assertEquals(0, policy.particleCount)
    }
    @Test fun independentSwitchesAndReducedMotionOverrideAreReal() {
        val policy = resolveAmbientPolicy(config.copy(backgroundMotion = false, lyricMotionEnabled = false), foreground, true)
        assertFalse(policy.animate); assertFalse(policy.lyricMotion); assertEquals(32, policy.particleCount)
        assertTrue(resolveAmbientPolicy(config.copy(respectReducedMotion = false), foreground.copy(systemMotion = false), true).animate)
    }
}
