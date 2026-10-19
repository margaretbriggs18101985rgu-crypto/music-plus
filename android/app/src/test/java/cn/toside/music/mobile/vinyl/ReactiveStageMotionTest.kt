package cn.toside.music.mobile.vinyl

import org.junit.Assert.*
import org.junit.Test

class ReactiveStageMotionTest {
    @Test fun noDataAndDisabledCinemaCannotMoveTheCamera() {
        val loud = AudioMotion(1f, 1f, 1f, 1f, 1f, available = true)
        assertEquals(StageCamera(), stageCamera(AudioMotion(), ReactiveVisuals(), true))
        assertEquals(StageCamera(), stageCamera(loud, ReactiveVisuals(), false))
        assertEquals(StageCamera(), stageCamera(loud, ReactiveVisuals(cinemaEnabled = false), true))
        assertEquals(StageCamera(), stageCamera(loud, ReactiveVisuals(intensity = 0f), true))
    }

    @Test fun frequencyWeightsControlIndependentMotionAndKickIsLimitedToReadableGeometry() {
        val bass = AudioMotion(bass = 1f, beat = 1f, available = true)
        val fx = ReactiveVisuals()
        val kick = stageCamera(bass, fx, true)
        assertTrue(kick.scale > 1f && kick.scale < 1.04f)
        assertTrue(kick.pitch < 0f && kick.pitch > -3f)
        assertEquals(StageCamera(), stageCamera(bass, fx.copy(bassWeight = 0f), true))
        val middle = stageCamera(AudioMotion(mid = 1f, available = true), fx, true)
        val high = stageCamera(AudioMotion(treble = 1f, available = true), fx, true)
        assertTrue(middle.yaw > 0f && high.yaw < 0f)
    }
}
