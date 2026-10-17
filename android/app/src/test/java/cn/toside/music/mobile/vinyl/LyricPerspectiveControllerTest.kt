package cn.toside.music.mobile.vinyl

import org.junit.Assert.*
import org.junit.Test

class LyricPerspectiveControllerTest {
    @Test fun neutralHasNoTranslationOrRotation() {
        assertEquals(LyricPerspective(), lyricPerspective(0f, 1080f, 3f))
    }
    @Test fun dragIsSymmetricAndHasDifferentDepths() {
        val right = lyricPerspective(100f, 1080f, 3f)
        val left = lyricPerspective(-100f, 1080f, 3f)
        assertEquals(-right.translationPx, left.translationPx, .001f)
        assertEquals(-right.yaw, left.yaw, .001f)
        assertEquals(85f, right.translationPx, .001f)
        assertEquals(15f, right.backgroundPx, .001f)
        assertEquals(30f, right.midgroundPx, .001f)
        assertEquals(45f, right.foregroundPx, .001f)
        assertTrue(right.backgroundPx < right.midgroundPx && right.midgroundPx < right.foregroundPx)
    }
    @Test fun outOfBoundsDragCannotMakeTextUnreadable() {
        val view = lyricPerspective(Float.MAX_VALUE, 1080f, 3f)
        assertEquals(302.4f, view.dragPx, .001f)
        assertEquals(144f, view.translationPx, .001f)
        assertEquals(9f, view.yaw, .001f)
        assertEquals(-9f, lyricPerspective(-Float.MAX_VALUE, 320f, 1f).yaw, .001f)
    }
    @Test fun smallScreenAndInvalidGeometryStayFinite() {
        assertEquals(9f, lyricPerspective(90f, 320f, 1f).yaw, .001f)
        for (width in listOf(0f, -1f, Float.NaN, Float.POSITIVE_INFINITY)) {
            assertEquals(LyricPerspective(), lyricPerspective(20f, width, 2f))
        }
        for (invalid in listOf(Float.NaN, Float.NEGATIVE_INFINITY, Float.POSITIVE_INFINITY)) {
            assertEquals(LyricPerspective(), lyricPerspective(invalid, 320f, 1f))
            assertEquals(LyricPerspective(), lyricPerspective(20f, 320f, invalid))
        }
        assertEquals(LyricPerspective(), lyricPerspective(20f, 320f, 0f))
    }
    @Test fun verticalScrollWinsDiagonalsAndKeepsItsLock() {
        val gesture = LyricDragSession()
        gesture.move(5f, 7f, 8f)
        assertEquals(LyricDragAxis.Pending, gesture.axis)
        gesture.move(9f, 9f, 8f)
        assertEquals(LyricDragAxis.Vertical, gesture.axis)
        gesture.move(200f, 10f, 8f)
        assertEquals(LyricDragAxis.Vertical, gesture.axis)
        assertEquals(0f, gesture.dragPx, 0f)
    }
    @Test fun horizontalMotionTracksInputWithoutInterpolation() {
        val gesture = LyricDragSession()
        gesture.move(12f, 3f, 8f)
        assertEquals(LyricDragAxis.Horizontal, gesture.axis)
        assertEquals(12f, gesture.dragPx, 0f)
        gesture.move(-35f, 80f, 8f)
        assertEquals(-35f, gesture.dragPx, 0f)
    }
    @Test fun releaseAndCancelAllowANewVerticalGesture() {
        repeat(2) {
            val gesture = LyricDragSession()
            gesture.move(100f, 2f, 8f)
            gesture.reset()
            assertEquals(0f, gesture.dragPx, 0f)
            assertEquals(LyricDragAxis.Pending, gesture.axis)
            gesture.move(1f, 100f, 8f)
            assertEquals(LyricDragAxis.Vertical, gesture.axis)
        }
    }
    @Test fun corruptInputClearsGestureState() {
        val gesture = LyricDragSession()
        gesture.move(100f, 0f, 8f)
        gesture.move(Float.NaN, 2f, 8f)
        assertEquals(LyricDragAxis.Pending, gesture.axis)
        assertEquals(0f, gesture.dragPx, 0f)
    }
}
