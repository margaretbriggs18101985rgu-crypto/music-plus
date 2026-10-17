package cn.toside.music.mobile.vinyl

import org.junit.Assert.*
import org.junit.Test

class AmbientParticlesTest {
    @Test fun seedIsStableAndQualityOnlyTruncatesThePopulation() {
        val high = createAmbientParticles(17, 420)
        assertEquals(high, createAmbientParticles(17, 420))
        assertEquals(high.take(80), createAmbientParticles(17, 80))
        assertNotEquals(high, createAmbientParticles(18, 420))
        assertEquals(420, createAmbientParticles(17, 1000).size)
        assertTrue(createAmbientParticles(17, -1).isEmpty())
    }
    @Test fun particlesHaveBoundedCoordinatesSpeedAndThreeParallaxDepths() {
        val particles = createAmbientParticles(17, 420)
        assertEquals(setOf(.15f, .30f, .45f), particles.map { it.depth }.toSet())
        for (particle in particles) {
            assertTrue(particle.x in 0f..1f && particle.y in 0f..1f)
            assertTrue(particle.speed in .0015f.. .0045f)
            assertTrue(particle.radius in .65f..2.5f)
        }
    }
    @Test fun wrapAroundAndInvalidTimeAreSafe() {
        assertEquals(.8f, ambientFraction(-.2), .000001f)
        assertEquals(.2f, ambientFraction(5.2), .000001f)
        assertEquals(0f, ambientFraction(Double.NaN), 0f)
        assertEquals(0f, ambientFraction(Double.POSITIVE_INFINITY), 0f)
    }
}
