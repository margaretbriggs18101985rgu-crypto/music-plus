package cn.toside.music.mobile.vinyl

import androidx.compose.ui.graphics.Color

/** Values supplied by the existing player; this screen never creates an audio engine. */
data class VinylPlayerState(
    val trackId: String = "",
    val title: String = "还没有播放的歌曲",
    val artist: String = "从搜索或我的音乐中选择一首歌曲",
    val artwork: String? = null,
    val artworkUserAgent: String = "",
    val isPlaying: Boolean = false,
    val hasTrack: Boolean = false,
    val isStopped: Boolean = true,
    val position: Double = 0.0,
    val duration: Double = 0.0,
    val favorite: Boolean = false,
    val status: String = "选择歌曲后即可播放",
    val topInset: Float = 0f,
    val bottomInset: Float = 0f,
    val demo: Boolean = false,
    val lyricsVisible: Boolean = false,
    val lyrics: List<VinylLyricLine> = emptyList(),
    val activeLyric: Int = -1,
    val seekRevision: Int = 0,
    val playMode: String = "listLoop",
)

data class VinylLyricLine(val time: Double, val text: String, val translation: String = "")

object VinylPalette {
    val Top = Color(0xFF625D65)
    val Middle = Color(0xFF49464D)
    val Bottom = Color(0xFF2A292D)
    val White = Color(0xFFF3F4F6)
    val Muted = Color(0xFFAAA6AD)
    val Red = Color(0xFFFF4055)
}

typealias PlayerAction = (action: String, value: Double) -> Unit
