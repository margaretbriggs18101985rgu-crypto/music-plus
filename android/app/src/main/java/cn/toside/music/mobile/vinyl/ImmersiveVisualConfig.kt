package cn.toside.music.mobile.vinyl

import android.app.ActivityManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.database.ContentObserver
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner

internal enum class ParticleQuality { Auto, Low, High, Off }

/** RN settings are normalized here; old bridge payloads retain safe defaults. */
internal data class ImmersiveVisualConfig(
    val visualEffectsEnabled: Boolean = true,
    val lyricMotionEnabled: Boolean = true,
    val respectReducedMotion: Boolean = true,
    val backgroundMotion: Boolean = true,
    val particleQuality: ParticleQuality = ParticleQuality.Auto,
)

internal data class ImmersiveEnvironment(val foreground: Boolean = false, val systemMotion: Boolean = true,
    val lowRam: Boolean = false, val powerSave: Boolean = false)

internal data class AmbientPolicy(val animate: Boolean, val particleCount: Int, val lyricMotion: Boolean, val colorMotion: Boolean)

internal fun resolveAmbientPolicy(config: ImmersiveVisualConfig, environment: ImmersiveEnvironment, lyricsVisible: Boolean): AmbientPolicy {
    val allowed = config.visualEffectsEnabled && environment.foreground &&
        (!config.respectReducedMotion || environment.systemMotion) && !environment.powerSave
    val count = if (!allowed || !lyricsVisible) 0 else when {
        config.particleQuality == ParticleQuality.Off -> 0
        environment.lowRam || config.particleQuality == ParticleQuality.Low -> 80
        config.particleQuality == ParticleQuality.High -> 420
        else -> 240
    }
    return AmbientPolicy(allowed && lyricsVisible && config.backgroundMotion,
        count, allowed && config.lyricMotionEnabled, allowed)
}

@Composable
internal fun rememberImmersiveEnvironment(): ImmersiveEnvironment {
    val context = LocalContext.current.applicationContext
    val resolver = context.contentResolver
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var environment by remember { mutableStateOf(ImmersiveEnvironment()) }
    DisposableEffect(lifecycle, resolver) {
        fun refresh() {
            environment = ImmersiveEnvironment(
                foreground = lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED),
                systemMotion = Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f,
                lowRam = (context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager)?.isLowRamDevice == true,
                powerSave = (context.getSystemService(Context.POWER_SERVICE) as? PowerManager)?.isPowerSaveMode == true,
            )
        }
        val lifecycleObserver = LifecycleEventObserver { _, _ -> refresh() }
        val settingsObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) = refresh()
        }
        val powerReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) = refresh()
        }
        refresh()
        lifecycle.addObserver(lifecycleObserver)
        resolver.registerContentObserver(Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE), false, settingsObserver)
        val filter = IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED)
        if (Build.VERSION.SDK_INT >= 33) context.registerReceiver(powerReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        else context.registerReceiver(powerReceiver, filter)
        onDispose {
            lifecycle.removeObserver(lifecycleObserver)
            resolver.unregisterContentObserver(settingsObserver)
            context.unregisterReceiver(powerReceiver)
        }
    }
    return environment
}

internal fun visualConfigForState(state: VinylPlayerState) = ImmersiveVisualConfig(
    visualEffectsEnabled = state.immersiveVisualsEnabled,
    lyricMotionEnabled = state.lyricMotionEnabled,
    respectReducedMotion = state.respectReducedMotion,
    backgroundMotion = state.backgroundMotion,
    particleQuality = when (state.particleQuality) {
        "low" -> ParticleQuality.Low
        "high" -> ParticleQuality.High
        "off" -> ParticleQuality.Off
        else -> ParticleQuality.Auto
    },
)
