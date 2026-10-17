package cn.toside.music.mobile.vinyl

import org.junit.Assert.*
import org.junit.Test
import kotlin.math.abs

class LyricPerspectiveControllerTest {
    @Test fun dragRotatesBothAxesWithMineradioSensitivity() {
        val rotation = rotateLyric(LyricRotation(), 100f, 100f)
        assertEquals(19.481f, rotation.yaw, .001f)
        assertEquals(18.335f, rotation.pitch, .001f)
        val opposite = rotateLyric(LyricRotation(), -100f, -100f)
        assertEquals(-rotation.yaw, opposite.yaw, .001f)
        assertEquals(-rotation.pitch, opposite.pitch, .001f)
    }
    @Test fun fullTurnsAreAllowedAndRebasedWithoutClamping() {
        assertEquals(rotateLyric(LyricRotation(), 40f, 0f).yaw,
            rotateLyric(LyricRotation(), 40f + 360f / .19481f, 0f).yaw, .001f)
        assertTrue(abs(rotateLyric(LyricRotation(), 500f, 0f).yaw) > 90f)
    }
    @Test fun releaseDecaysAndKeepsTheFinalOrientation() {
        var spin = lyricReleaseSpin(LyricRotation(15f, 20f), 500f, 200f)
        val first = advanceLyricSpin(spin, 1f / 60)
        assertTrue(first.rotation.yaw > 20f && first.rotation.pitch > 15f)
        assertTrue(first.yawSpeed < spin.yawSpeed)
        repeat(240) { spin = advanceLyricSpin(spin, 1f / 60) }
        assertEquals(0f, spin.yawSpeed + spin.pitchSpeed, 0f)
        assertTrue(spin.rotation.yaw > 20f && spin.rotation.pitch > 15f)
        assertEquals(spin, advanceLyricSpin(spin, .08f))
    }
    @Test fun cancellationAndInvalidSamplesDoNotIntroduceVelocity() {
        assertEquals(LyricRotation(), rotateLyric(LyricRotation(), Float.NaN, 1f))
        val spin = lyricReleaseSpin(LyricRotation(), Float.NaN, Float.POSITIVE_INFINITY)
        assertEquals(0f, spin.pitchSpeed + spin.yawSpeed, 0f)
        assertTrue(lyricReleaseSpin(LyricRotation(), Float.MAX_VALUE, Float.MAX_VALUE).yawSpeed <= 355.2f)
        assertEquals(0f, wrapLyricAngle(Float.NaN), 0f)
    }
    @Test fun inertiaIsStableAcrossRefreshRates() {
        fun after(hz: Int): LyricSpin {
            var spin = lyricReleaseSpin(LyricRotation(), 800f, 400f)
            repeat(hz) { spin = advanceLyricSpin(spin, 1f / hz) }
            return spin
        }
        assertEquals(after(60).rotation.yaw, after(120).rotation.yaw, 1f)
        assertEquals(after(60).rotation.pitch, after(120).rotation.pitch, 1f)
    }
}
