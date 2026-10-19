package cn.toside.music.mobile.vinyl

import org.junit.Assert.*
import org.junit.Test

class LyricScrollGeometryTest {
    @Test fun wrappedAndTranslatedRowsKeepTheirMeasuredCenters() {
        val centers = lyricRowCenters(intArrayOf(40, 120, 60), 20f)
        assertArrayEquals(floatArrayOf(20f, 120f, 230f), centers, .001f)
        assertEquals(120f, lyricCameraCenter(6f, 5, centers), .001f)
        assertEquals(175f, lyricCameraCenter(6.5f, 5, centers), .001f)
    }

    @Test fun movingWindowDoesNotJumpAtTheVirtualizationBoundary() {
        val heights = IntArray(30) { if (it % 3 == 0) 120 else 40 }
        fun position(cursor: Float): Float {
            val window = lyricScrollWindow(cursor, heights.size)
            val centers = lyricRowCenters(window.map { heights[it] }.toIntArray(), 20f)
            return centers[10 - window.first] - lyricCameraCenter(cursor, window.first, centers)
        }
        assertEquals(position(9.99999f), position(10f), .01f)
        assertEquals(position(10f), position(10.00001f), .01f)
    }

    @Test fun windowsStayBoundedForSeeksAndTrackEdges() {
        assertEquals(6..14, lyricScrollWindow(10.4f, 5000))
        assertEquals(0..4, lyricScrollWindow(-1f, 30))
        assertEquals(25..29, lyricScrollWindow(29f, 30))
        assertTrue(lyricScrollWindow(0f, 0).isEmpty())
        assertEquals(0..0, lyricScrollWindow(Float.NaN, 1))
        assertEquals(0f, lyricCameraCenter(3f, 0, floatArrayOf()), 0f)
    }

    @Test fun tallViewportsCanRenderMoreContextWithoutUnboundedWork() {
        assertEquals(2..18, lyricScrollWindow(10f, 100, 8))
        assertEquals(34..66, lyricScrollWindow(50f, 5000, 1000))
    }
}
