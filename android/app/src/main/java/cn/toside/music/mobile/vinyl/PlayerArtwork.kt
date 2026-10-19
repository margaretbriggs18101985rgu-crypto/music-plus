package cn.toside.music.mobile.vinyl

import android.graphics.drawable.BitmapDrawable
import android.util.Log
import androidx.compose.runtime.*
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.core.graphics.drawable.toBitmap
import cn.toside.music.mobile.BuildConfig
import coil.compose.AsyncImagePainter
import coil.compose.rememberAsyncImagePainter
import coil.imageLoader
import coil.request.ImageRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext

/** One painter/request for both the record and palette. A mode/progress update cannot reload it. */
@Composable
internal fun rememberPlayerArtwork(state: VinylPlayerState): AsyncImagePainter =
    key(state.trackId, state.artwork, state.artworkUserAgent, state.reactiveVisuals.coverResolution) {
        val context = LocalContext.current
        val request = remember {
            ImageRequest.Builder(context.applicationContext).data(state.artwork).size(state.reactiveVisuals.coverResolution).allowHardware(false)
                .crossfade(300).apply {
                    if (state.artworkUserAgent.isNotBlank()) addHeader("User-Agent", state.artworkUserAgent)
                }.build()
        }
        // Explicit size lets Coil finish even when the record is hidden by lyric mode.
        rememberAsyncImagePainter(request, context.imageLoader, contentScale = ContentScale.Crop)
    }

@Composable
internal fun rememberArtworkPalette(painter: AsyncImagePainter): State<AmbientPalette> = key(painter) {
    val success = painter.state as? AsyncImagePainter.State.Success
    produceState(AmbientPalette.Fallback, success) {
        value = AmbientPalette.Fallback
        if (success != null) {
            val palette = withContext(Dispatchers.Default) {
                val drawable = success.result.drawable
                val bitmap = (drawable as? BitmapDrawable)?.bitmap ?: drawable.toBitmap(64, 64)
                val stepX = (bitmap.width / 32).coerceAtLeast(1)
                val stepY = (bitmap.height / 32).coerceAtLeast(1)
                val sample = ArrayList<Int>(1024)
                for (y in 0 until bitmap.height step stepY) {
                    ensureActive()
                    for (x in 0 until bitmap.width step stepX) sample.add(bitmap.getPixel(x, y))
                }
                extractAmbientPalette(sample.toIntArray())
            }
            // The effect and painter are keyed by the actual request. Obsolete work cannot apply.
            value = palette
            if (BuildConfig.DEBUG) Log.d("ImmersiveArtwork", "palette=${palette.top.toUInt().toString(16)} cache=${success.result.dataSource}")
        }
    }
}
