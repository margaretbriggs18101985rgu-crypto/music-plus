package cn.toside.music.mobile.vinyl

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.graphics.SweepGradient
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import cn.toside.music.mobile.vinyl.PageText as BasicText
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import coil.compose.AsyncImagePainter

/** Cached once: fine concentric grooves, pressed edge and broad, low-contrast reflections. */
internal fun createVinylTexture(): Bitmap {
    val bitmap = Bitmap.createBitmap(1024, 1024, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.shader = RadialGradient(512f, 512f, 510f,
        intArrayOf(0xFF111212.toInt(), 0xFF181919.toInt(), 0xFF090A0A.toInt(), 0xFF020303.toInt()),
        floatArrayOf(0f, .65f, .96f, 1f), Shader.TileMode.CLAMP)
    canvas.drawCircle(512f, 512f, 510f, paint)
    paint.shader = null
    paint.style = Paint.Style.STROKE
    for (i in 0..157) {
        val radius = 176f + i * 2.08f
        val gray = when (i % 7) { 0 -> 39; 1 -> 13; 2 -> 32; else -> 21 }
        paint.color = android.graphics.Color.rgb(gray, gray + 1, gray + 1)
        paint.strokeWidth = if (i % 5 == 0) 1.2f else .65f
        canvas.drawCircle(512f, 512f, radius, paint)
    }
    paint.style = Paint.Style.FILL
    paint.shader = SweepGradient(512f, 512f,
        intArrayOf(0x002C3032, 0x34454A4D, 0x00000000, 0x002C3032, 0x2A565B5E, 0x00000000, 0x002C3032),
        floatArrayOf(0f, .13f, .29f, .49f, .64f, .81f, 1f))
    canvas.drawCircle(512f, 512f, 507f, paint)
    paint.shader = null
    paint.color = 0x5A677077
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 1.2f
    canvas.drawCircle(512f, 512f, 508f, paint)
    return bitmap
}

@Composable
internal fun VinylRecord(
    state: VinylPlayerState,
    diameter: Dp,
    clock: VinylRotationClock,
    artworkPainter: AsyncImagePainter,
    modifier: Modifier = Modifier,
) {
    val texture = remember { createVinylTexture().asImageBitmap() }
    var angle by remember { mutableFloatStateOf(clock.angle.toFloat()) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var foreground by remember { mutableStateOf(lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) }
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, _ ->
            foreground = lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
        }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer); clock.pause() }
    }
    // Progress/title updates cannot restart this effect: only actual playback/lifecycle do.
    LaunchedEffect(state.isPlaying, foreground, clock) {
        clock.pause()
        if (state.isPlaying && foreground) {
            try { while (true) withFrameNanos { angle = clock.frame(it) } }
            finally { clock.pause() }
        }
    }
    Box(modifier.size(diameter).shadow(10.dp, CircleShape).clip(CircleShape)
        .background(Color(0xFF080A0B)).border(1.dp, Color.White.copy(alpha = .09f), CircleShape)) {
        Box(Modifier.fillMaxSize().graphicsLayer { rotationZ = angle }, contentAlignment = Alignment.Center) {
            Image(texture, contentDescription = "黑胶唱片沟槽", modifier = Modifier.fillMaxSize())
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Box(Modifier.fillMaxSize(.645f).clip(CircleShape).background(Color(0xFF36495B))
                    .border(.7.dp, Color.Black.copy(alpha = .7f), CircleShape), contentAlignment = Alignment.Center) {
                    if (state.artwork.isNullOrBlank() || artworkPainter.state is AsyncImagePainter.State.Error) {
                        BasicText("LX / MUSIC", style = TextStyle(color = VinylPalette.Muted,
                            fontSize = 16.sp, fontWeight = FontWeight.Medium, letterSpacing = 2.sp))
                    } else {
                        Image(painter = artworkPainter, contentDescription = "专辑封面", contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize())
                    }
                }
            }
        }
    }
}
