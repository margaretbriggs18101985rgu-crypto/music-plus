package cn.toside.music.mobile.vinyl

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType

class HomeWidgetModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "MusicHomeWidget"

    @ReactMethod
    fun updatePlayer(map: ReadableMap) {
        fun string(key: String) = if (map.hasKey(key) && map.getType(key) == ReadableType.String) map.getString(key).orEmpty() else ""
        fun number(key: String) = if (map.hasKey(key) && map.getType(key) == ReadableType.Number) map.getDouble(key).takeIf(Double::isFinite) ?: 0.0 else 0.0
        fun bool(key: String) = map.hasKey(key) && map.getType(key) == ReadableType.Boolean && map.getBoolean(key)

        HomeWidgetController.update(context, MusicWidgetState(
            trackId = string("trackId"),
            title = string("title"),
            artist = string("artist"),
            artwork = string("artwork"),
            artworkUserAgent = string("artworkUserAgent"),
            hasTrack = bool("hasTrack"),
            isPlaying = bool("isPlaying"),
            position = number("position").coerceAtLeast(0.0),
            duration = number("duration").coerceAtLeast(0.0),
            seekRevision = number("seekRevision").toInt(),
        ))
    }
}
