package cn.toside.music.mobile.vinyl

import org.junit.Assert.*
import org.junit.Test

class AmbientPaletteTest {
    @Test fun unavailableOrUninformativePixelsUseDarkFallback() {
        for (pixels in listOf(intArrayOf(), intArrayOf(0x00FF0000), intArrayOf(-1), intArrayOf(0xFF000000.toInt()))) {
            assertEquals(AmbientPalette.Fallback, extractAmbientPalette(pixels))
        }
    }
    @Test fun representativeColorIsDeterministicAndTracksCoverHue() {
        val red = IntArray(800) { 0xFFF02030.toInt() } + IntArray(100) { 0xFF2050F0.toInt() }
        val palette = extractAmbientPalette(red)
        assertEquals(palette, extractAmbientPalette(red.reversedArray()))
        assertNotEquals(palette, extractAmbientPalette(IntArray(800) { 0xFF2050F0.toInt() }))
        assertTrue(((palette.top shr 16) and 255) > (palette.top and 255))
    }
    @Test fun extremeSaturationAndBrightnessRemainDarkAndOpaque() {
        for (color in listOf(0xFFFF0000, 0xFF00FF00, 0xFF0000FF, 0xFFFFFF00, 0xFFF0F0F0, 0xFF111111)) {
            val palette = extractAmbientPalette(intArrayOf(color.toInt()))
            for (background in listOf(palette.top, palette.middle, palette.bottom)) {
                assertEquals(255, background ushr 24)
                assertTrue(ambientLuminance(background) < .04)
                assertTrue(1.05 / (ambientLuminance(background) + .05) > 10)
            }
        }
    }
    @Test fun transparentColorsCannotOverrideTheLoadedImage() {
        val blue = intArrayOf(0xFF2050F0.toInt())
        assertEquals(extractAmbientPalette(blue), extractAmbientPalette(blue + IntArray(500) { 0x00FF0000 }))
    }
}
