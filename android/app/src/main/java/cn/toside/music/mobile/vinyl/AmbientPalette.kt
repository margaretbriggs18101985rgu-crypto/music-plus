package cn.toside.music.mobile.vinyl

import kotlin.math.pow
import kotlin.math.roundToInt

internal data class AmbientPalette(val top: Int, val middle: Int, val bottom: Int, val accent: Int) {
    companion object {
        // Darkened versions of the existing VinylPalette Top/Middle/Bottom, never a white placeholder.
        val Fallback = AmbientPalette(shade(0xFF625D65.toInt(), .36), shade(0xFF49464D.toInt(), .32),
            shade(0xFF2A292D.toInt(), .45), 0xFFAEB5CE.toInt())
    }
}

private fun argb(r: Double, g: Double, b: Double): Int = 0xFF000000.toInt() or
    ((r.coerceIn(0.0, 1.0) * 255).roundToInt() shl 16) or
    ((g.coerceIn(0.0, 1.0) * 255).roundToInt() shl 8) or (b.coerceIn(0.0, 1.0) * 255).roundToInt()

private fun shade(color: Int, factor: Double) = argb(((color shr 16) and 255) / 255.0 * factor,
    ((color shr 8) and 255) / 255.0 * factor, (color and 255) / 255.0 * factor)

/** Pure representative-color extraction from a small sample, not from animation frames. */
internal fun extractAmbientPalette(pixels: IntArray): AmbientPalette {
    val buckets = IntArray(4096)
    for (pixel in pixels) {
        if ((pixel ushr 24) < 128) continue
        val r = (pixel shr 16) and 255; val g = (pixel shr 8) and 255; val b = pixel and 255
        val light = (.2126 * r + .7152 * g + .0722 * b) / 255
        if (light < .025 || light > .97) continue
        buckets[((r shr 4) shl 8) or ((g shr 4) shl 4) or (b shr 4)]++
    }
    var best = -1
    var score = 0.0
    for (index in buckets.indices) {
        if (buckets[index] == 0) continue
        val r = ((index shr 8) and 15) / 15.0
        val g = ((index shr 4) and 15) / 15.0
        val b = (index and 15) / 15.0
        val chroma = maxOf(r, g, b) - minOf(r, g, b)
        val candidate = buckets[index] * (.3 + chroma)
        if (candidate > score) { score = candidate; best = index }
    }
    if (best < 0) return AmbientPalette.Fallback
    val r = ((best shr 8) and 15) / 15.0; val g = ((best shr 4) and 15) / 15.0; val b = (best and 15) / 15.0
    val gray = (r + g + b) / 3
    fun tone(base: Double, range: Double) = argb(base + range * (r * .6 + gray * .4),
        base + range * (g * .6 + gray * .4), base + range * (b * .6 + gray * .4))
    return AmbientPalette(tone(.035, .11), tone(.025, .07), tone(.022, .035), tone(.50, .24))
}

internal fun ambientLuminance(color: Int): Double {
    fun linear(channel: Int): Double { val c = channel / 255.0; return if (c <= .04045) c / 12.92 else ((c + .055) / 1.055).pow(2.4) }
    return .2126 * linear((color shr 16) and 255) + .7152 * linear((color shr 8) and 255) + .0722 * linear(color and 255)
}
