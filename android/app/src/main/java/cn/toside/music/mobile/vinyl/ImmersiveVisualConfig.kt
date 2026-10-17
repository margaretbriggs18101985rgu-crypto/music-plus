package cn.toside.music.mobile.vinyl

import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner

/** Internal switches for P1. Persistent product settings are introduced in P3. */
internal data class ImmersiveVisualConfig(
    val lyricMotionEnabled: Boolean = true,
    val respectReducedMotion: Boolean = true,
)

@Composable
internal fun rememberLyricMotionEnabled(config: ImmersiveVisualConfig): Boolean {
    val resolver = LocalContext.current.contentResolver
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var foreground by remember { mutableStateOf(lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) }
    var systemMotion by remember { mutableStateOf(true) }
    DisposableEffect(lifecycle, resolver) {
        fun refresh() {
            foreground = lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
            systemMotion = Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f
        }
        val lifecycleObserver = LifecycleEventObserver { _, _ -> refresh() }
        val settingsObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) = refresh()
        }
        refresh()
        lifecycle.addObserver(lifecycleObserver)
        resolver.registerContentObserver(Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE), false, settingsObserver)
        onDispose {
            lifecycle.removeObserver(lifecycleObserver)
            resolver.unregisterContentObserver(settingsObserver)
        }
    }
    return foreground && config.lyricMotionEnabled && (!config.respectReducedMotion || systemMotion)
}
