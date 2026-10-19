package cn.toside.music.mobile.vinyl

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.background
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.remember
import coil.compose.AsyncImage
import coil.ImageLoader
import coil.decode.GifDecoder
import java.io.File

internal fun hasPlayerWallpaper(state: VinylPlayerState): Boolean =
    state.wallpaperPath.isNotBlank() && state.wallpaperKind != "none" && state.wallpaperKind != "mpkg" &&
        (state.wallpaperScope == "all" || state.wallpaperScope == "player")

@Composable
internal fun PlayerWallpaper(state: VinylPlayerState) {
    if (!hasPlayerWallpaper(state)) return
    if (state.wallpaperKind == "video") {
        AndroidView(
            factory = { WallpaperView(it).apply { playbackPriority = 1 } },
            update = { it.setPath(state.wallpaperPath); it.setKind(state.wallpaperKind) },
            onRelease = { it.release() },
            modifier = Modifier.fillMaxSize(),
        )
    } else {
        val context = LocalContext.current
        val imageLoader = remember(context) {
            ImageLoader.Builder(context.applicationContext)
                .components { add(GifDecoder.Factory()) }
                .build()
        }
        Box(Modifier.fillMaxSize()) {
            AsyncImage(model = File(state.wallpaperPath), imageLoader = imageLoader, contentDescription = null,
                contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .18f)))
        }
    }
    if (state.wallpaperKind == "video") Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .18f)))
}
