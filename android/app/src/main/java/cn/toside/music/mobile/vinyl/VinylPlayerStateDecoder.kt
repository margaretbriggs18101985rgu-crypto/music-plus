package cn.toside.music.mobile.vinyl

import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType

internal fun decodeVinylPlayerState(map: ReadableMap): VinylPlayerState {
    fun string(key: String, fallback: String = "") = if (map.hasKey(key) && !map.isNull(key)) map.getString(key) ?: fallback else fallback
    fun number(key: String, fallback: Double = 0.0) = if (map.hasKey(key) && !map.isNull(key)) map.getDouble(key) else fallback
    fun bool(key: String, fallback: Boolean = false) = if (map.hasKey(key) && map.getType(key) == ReadableType.Boolean) map.getBoolean(key) else fallback
    val visuals = if (map.hasKey("reactiveVisuals") && map.getType("reactiveVisuals") == ReadableType.Map) map.getMap("reactiveVisuals") else null
    fun visualNumber(key: String, fallback: Float, min: Float, max: Float): Float {
        val value = if (visuals?.hasKey(key) == true && visuals.getType(key) == ReadableType.Number) visuals.getDouble(key).toFloat() else fallback
        return if (value.isFinite()) value.coerceIn(min, max) else fallback
    }
    fun visualBool(key: String, fallback: Boolean) = if (visuals?.hasKey(key) == true && visuals.getType(key) == ReadableType.Boolean) visuals.getBoolean(key) else fallback
    return VinylPlayerState(
        trackId = string("trackId"), title = string("title"), artist = string("artist"),
        artwork = string("artwork").ifBlank { null }, isPlaying = bool("isPlaying"),
        artworkUserAgent = string("artworkUserAgent"),
        hasTrack = bool("hasTrack"), isStopped = bool("isStopped"), position = number("position"),
        duration = number("duration"), favorite = bool("favorite"), status = string("status"),
        playbackRate = number("playbackRate", 1.0).let { if (it.isFinite()) it.coerceIn(.25, 4.0) else 1.0 },
        topInset = number("topInset").toFloat(), bottomInset = number("bottomInset").toFloat(),
        lyricsVisible = bool("lyricsVisible"), activeLyric = number("activeLyric").toInt(), playMode = string("playMode", "listLoop"),
        seekRevision = number("seekRevision").toInt(),
        immersiveVisualsEnabled = bool("immersiveVisualsEnabled", true),
        reactiveVisuals = ReactiveVisuals(
            intensity = visualNumber("intensity", 0.85f, 0.00f, 2.00f),
            depth = visualNumber("depth", 0.20f, 0.00f, 1.00f),
            coverResolution = visualNumber("coverResolution", 512.00f, 64.00f, 512.00f).toInt(),
            cinema = visualNumber("cinema", 0.50f, 0.00f, 1.50f),
            particleSize = visualNumber("particleSize", 1.00f, 0.30f, 3.00f),
            speed = visualNumber("speed", 1.00f, 0.00f, 3.00f),
            twist = visualNumber("twist", 0.00f, 0.00f, 2.00f),
            colorTension = visualNumber("colorTension", 1.10f, 0.00f, 2.00f),
            bloom = visualNumber("bloom", 0.62f, 0.00f, 1.50f),
            scatter = visualNumber("scatter", 0.00f, 0.00f, 1.00f),
            backgroundDim = visualNumber("backgroundDim", 0.20f, 0.00f, 1.00f),
            terrainHeight = visualNumber("terrainHeight", 0.55f, 0.00f, 1.50f),
            terrainDepth = visualNumber("terrainDepth", 0.60f, 0.00f, 1.00f),
            terrainOffset = visualNumber("terrainOffset", 0.78f, 0.40f, 1.00f),
            kickSensitivity = visualNumber("kickSensitivity", 1.00f, 0.40f, 2.00f),
            kickLowHz = visualNumber("kickLowHz", 45.00f, 25.00f, 110.00f),
            kickHighHz = visualNumber("kickHighHz", 170.00f, 120.00f, 300.00f),
            bassWeight = visualNumber("bassWeight", 1.00f, 0.00f, 2.00f),
            midWeight = visualNumber("midWeight", 0.65f, 0.00f, 2.00f),
            trebleWeight = visualNumber("trebleWeight", 0.45f, 0.00f, 2.00f),
            cinemaEnabled = visualBool("cinemaEnabled", true),
            particleGlow = visualBool("particleGlow", false),
            outlineHighlight = visualBool("outlineHighlight", false),
            starRiver = visualBool("starRiver", true),
            terrainEnabled = visualBool("terrainEnabled", false),
            spectrumEnabled = visualBool("spectrumEnabled", false),
            kickAuto = visualBool("kickAuto", true),
        ),
        particleQuality = if (map.hasKey("particleQuality") && map.getType("particleQuality") == ReadableType.String) string("particleQuality", "auto") else "auto",
        lyricMotionEnabled = bool("lyricMotionEnabled", true),
        lyricPulseEnabled = bool("lyricPulseEnabled", true),
        starPulseEnabled = bool("starPulseEnabled", true),
        lyricDisplayMode = string("lyricDisplayMode", "single").let { if (it == "multiple") it else "single" },
        lyricColor = string("lyricColor", "#A8F6FF"),
        lyricFontSize = if (map.hasKey("lyricFontSize")) number("lyricFontSize").toFloat().let { if (it.isFinite()) it.coerceIn(16f, 56f) else 40f } else 40f,
        lyricFontFamily = normalizeLyricFont(string("lyricFontFamily", "system")),
        pageFontFamily = normalizeLyricFont(string("pageFontFamily", "system")),
        pageFontColor = string("pageFontColor"),
        lyricAlign = string("lyricAlign", "center"),
        backgroundMotion = bool("backgroundMotion", true),
        respectReducedMotion = bool("respectReducedMotion", true),
        wallpaperPath = string("wallpaperPath"),
        wallpaperKind = string("wallpaperKind", "none"),
        wallpaperScope = string("wallpaperScope", "all"),
        lyrics = if (map.hasKey("lyrics") && !map.isNull("lyrics")) {
            val lines = map.getArray("lyrics")!!
            // Preserve slots (including duplicate timestamps) so activeLyric keeps its RN index.
            (0 until lines.size()).map { index ->
                val line = if (lines.getType(index) == ReadableType.Map) lines.getMap(index) else null
                fun text(key: String) = if (line?.hasKey(key) == true && line.getType(key) == ReadableType.String) line.getString(key) ?: "" else ""
                val time = if (line?.hasKey("time") == true && line.getType("time") == ReadableType.Number) line.getDouble("time") else Double.NaN
                val visibleText = text("text")
                val words = if (line?.hasKey("words") == true && line.getType("words") == ReadableType.Array) {
                    val values = line.getArray("words")!!
                    (0 until values.size()).mapNotNull { slot ->
                        val word = if (values.getType(slot) == ReadableType.Map) values.getMap(slot) else null
                        fun number(key: String) = if (word?.hasKey(key) == true && word.getType(key) == ReadableType.Number) word.getDouble(key) else Double.NaN
                        val start = number("start"); val end = number("end")
                        val from = number("startTime"); val to = number("endTime")
                        if (start.isFinite() && end.isFinite() && start >= 0 && end > start && end <= visibleText.length &&
                            from.isFinite() && to.isFinite() && to > from)
                            VinylLyricWord(start.toInt(), end.toInt(), from, to) else null
                    }
                } else emptyList()
                VinylLyricLine(time, visibleText, text("translation"), words)
            }
        } else emptyList(),
    )
}
