package cn.toside.music.mobile.vinyl

import org.junit.Assert.*
import org.junit.Test

class AmbientParticlesTest {
    @Test fun starsHaveIndependentMotionAndSelectedCountsProduceDifferentVisibleDensities() {
        val stars = createAmbientStars(17, MAX_AMBIENT_STARS)
        assertTrue(stars.any { it.velocityX > 0f } && stars.any { it.velocityX < 0f })
        assertTrue(stars.any { it.velocityY > 0f } && stars.any { it.velocityY < 0f })
        fun points(count: Int, time: Double): FloatArray {
            val population = stars.take(count)
            val buffers = ambientStarBuffers(population)
            val used = IntArray(STAR_BUCKETS)
            projectAmbientStars(population, 2400f, 1080f, 0f, 0f, buffers, used, time)
            return buffers.indices.flatMap { buffers[it].take(used[it]) }.toFloatArray()
        }
        val initial = points(6400, 0.0)
        val moved = points(6400, 1.0)
        assertFalse(initial.contentEquals(moved))
        assertTrue(initial.size > points(1200, 0.0).size * 4)
        assertTrue(points(0, 0.0).isEmpty())
        assertArrayEquals(initial, points(6400, 0.0), 0f)
        assertTrue(points(6400, 86400.0).all { it.isFinite() })
    }

    @Test fun seedIsStableAndQualityOnlyTruncatesThePopulation() {
        val high = createAmbientStars(17, MAX_AMBIENT_STARS)
        assertEquals(high, createAmbientStars(17, MAX_AMBIENT_STARS))
        assertEquals(high.take(1200), createAmbientStars(17, 1200))
        assertNotEquals(high, createAmbientStars(18, MAX_AMBIENT_STARS))
        assertEquals(MAX_AMBIENT_STARS, createAmbientStars(17, 10000).size)
        assertTrue(createAmbientStars(17, -1).isEmpty())
    }

    @Test fun allStarsFitTheBatchBuffersAndMostAreFineDistantPoints() {
        val stars = createAmbientStars(17, MAX_AMBIENT_STARS)
        val buffers = ambientStarBuffers(stars)
        assertEquals(stars.size * 2, buffers.sumOf { it.size })
        assertTrue(stars.all { it.x.isFinite() && it.y.isFinite() && it.z.isFinite() && it.bucket in 0 until STAR_BUCKETS })
        assertTrue(stars.count { it.bucket < 8 } > stars.size * .65)
    }

    @Test fun fullCameraRotationsAndBothAspectsKeepFiniteVisiblePointsWithoutOverflow() {
        val stars = createAmbientStars(17, MAX_AMBIENT_STARS)
        val buffers = ambientStarBuffers(stars)
        val used = IntArray(STAR_BUCKETS)
        for ((width, height) in listOf(1080f to 2400f, 2400f to 1080f)) {
            for (yaw in listOf(-3.14f, -1.57f, 0f, 1.57f, 3.14f)) for (pitch in listOf(-1.57f, 0f, 1.57f)) {
                projectAmbientStars(stars, width, height, yaw, pitch, buffers, used)
                assertTrue(used.sum() > 0)
                for (bucket in used.indices) {
                    assertTrue(used[bucket] <= buffers[bucket].size)
                    for (offset in 0 until used[bucket] step 2) {
                        assertTrue(buffers[bucket][offset] in -4f..width + 4f)
                        assertTrue(buffers[bucket][offset + 1] in -4f..height + 4f)
                    }
                }
            }
        }
        projectAmbientStars(stars, 0f, 0f, Float.NaN, 0f, buffers, used)
        assertEquals(0, used.sum())
    }
}
