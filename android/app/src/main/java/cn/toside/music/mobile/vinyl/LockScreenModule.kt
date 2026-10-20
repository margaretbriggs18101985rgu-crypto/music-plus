package cn.toside.music.mobile.vinyl

import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.Lifecycle
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.lang.ref.WeakReference

/** Lives with the existing playback process; never creates another player or wakes the display. */
internal object LockScreenController {
    val state = mutableStateOf(VinylPlayerState())
    var enabled = false
        private set
    private var app: Context? = null
    private var registered = false
    private var dismissed = false
    private var launching = false
    private var activity = WeakReference<LockScreenActivity>(null)
    private val handler = Handler(Looper.getMainLooper())
    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                Intent.ACTION_SCREEN_OFF -> {
                    dismissed = false
                    launching = false
                    activity.get()?.hideContent()
                }
                Intent.ACTION_SCREEN_ON -> {
                    maybeShow()
                    activity.get()?.takeIf { it.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED) }?.showContent()
                }
                Intent.ACTION_USER_PRESENT -> {
                    dismissed = false
                    activity.get()?.finish()
                }
            }
        }
    }

    fun setEnabled(context: Context, value: Boolean) {
        app = context.applicationContext
        enabled = value
        if (value && !registered) {
            val filter = IntentFilter().apply {
                addAction(Intent.ACTION_SCREEN_ON)
                addAction(Intent.ACTION_SCREEN_OFF)
                addAction(Intent.ACTION_USER_PRESENT)
            }
            if (Build.VERSION.SDK_INT >= 33) app!!.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
            else app!!.registerReceiver(receiver, filter)
            registered = true
        } else if (!value) {
            if (registered) app!!.unregisterReceiver(receiver)
            registered = false
            dismissed = false
            launching = false
            activity.get()?.finish()
            state.value = VinylPlayerState()
        }
    }

    fun update(value: VinylPlayerState) {
        if (!enabled) return
        state.value = value
        if (!value.hasTrack || !value.isPlaying || !isLocked()) activity.get()?.finish()
        else maybeShow()
    }

    fun isLocked(): Boolean = (app?.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager)?.isKeyguardLocked == true
    fun isInteractive(): Boolean = (app?.getSystemService(Context.POWER_SERVICE) as? PowerManager)?.isInteractive == true

    fun eligible(): Boolean {
        val context = app ?: return false
        val overlay = Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(context)
        return shouldShowLockScreen(enabled, state.value.hasTrack, state.value.isPlaying,
            isLocked(), isInteractive(), overlay, dismissed)
    }

    private fun maybeShow() {
        if (!eligible()) return
        activity.get()?.takeUnless { it.isFinishing }?.let { return }
        if (launching) return
        launching = true
        try {
            app!!.startActivity(Intent(app, LockScreenActivity::class.java).addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NO_ANIMATION))
        } catch (error: RuntimeException) {
            Log.w("LockScreenLyrics", "System blocked lock screen activity", error)
        }
        // Android can silently reject background launches. Allow a later screen-on to retry.
        handler.postDelayed({ launching = false }, 1500)
    }

    fun attach(value: LockScreenActivity) { activity = WeakReference(value); launching = false }
    fun detach(value: LockScreenActivity) { if (activity.get() === value) activity.clear() }
    fun dismiss() { dismissed = true; activity.get()?.finish() }
}

class LockScreenModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "LockScreenLyrics"
    @ReactMethod fun setEnabled(value: Boolean) {
        context.runOnUiQueueThread { LockScreenController.setEnabled(context, value) }
    }
    @ReactMethod fun updatePlayer(map: ReadableMap) {
        val state = decodeVinylPlayerState(map)
        context.runOnUiQueueThread { LockScreenController.update(state) }
    }
    override fun invalidate() {
        context.runOnUiQueueThread { LockScreenController.setEnabled(context, false) }
        super.invalidate()
    }
}
