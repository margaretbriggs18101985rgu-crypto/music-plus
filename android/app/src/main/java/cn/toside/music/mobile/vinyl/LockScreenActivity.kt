package cn.toside.music.mobile.vinyl

import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.ui.platform.ComposeView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.compose.runtime.mutableStateOf

/** An isolated surface above keyguard. Closing it always returns to the system lock screen. */
class LockScreenActivity : AppCompatActivity() {
    private var content: ComposeView? = null
    private val insets = mutableStateOf(floatArrayOf(0f, 0f, 0f, 0f))
    private val clock = VinylRotationClock()
    // Some ROMs omit USER_PRESENT when biometric/trust unlock occludes keyguard.
    // Poll only while this small surface is resumed; never while the display sleeps.
    private val checkKeyguard = object : Runnable {
        override fun run() {
            if (!LockScreenController.isLocked()) { finish(); return }
            window.decorView.postDelayed(this, 500)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!LockScreenController.eligible()) { finish(); return }
        if (Build.VERSION.SDK_INT >= 27) setShowWhenLocked(true)
        else @Suppress("DEPRECATION") window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
        // No DISMISS_KEYGUARD, TURN_SCREEN_ON or KEEP_SCREEN_ON flags.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        window.setBackgroundDrawableResource(android.R.color.black)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        LockScreenController.attach(this)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = LockScreenController.dismiss()
        })
    }

    override fun onResume() {
        super.onResume()
        if (!LockScreenController.eligible()) { finish(); return }
        showContent()
        window.decorView.removeCallbacks(checkKeyguard)
        window.decorView.post(checkKeyguard)
    }

    override fun onPause() {
        window.decorView.removeCallbacks(checkKeyguard)
        super.onPause()
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent) }

    fun showContent() {
        if (content != null || isFinishing || !LockScreenController.eligible()) return
        val view = ComposeView(this)
        content = view
        view.setContent {
            val bars = insets.value
            val state = LockScreenController.state.value.copy(topInset = bars[0], bottomInset = bars[1],
                startInset = bars[2], endInset = bars[3])
            PageTypographyScope(state) { LockScreenPlayer(state, clock, LockScreenController::dismiss) }
        }
        setContentView(view)
        ViewCompat.setOnApplyWindowInsetsListener(view) { _, value ->
            val bars = value.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val density = resources.displayMetrics.density
            insets.value = floatArrayOf(bars.top / density, bars.bottom / density, bars.left / density, bars.right / density)
            value
        }
        ViewCompat.requestApplyInsets(view)
    }

    fun hideContent() { content?.disposeComposition(); content = null }
    override fun onStop() { hideContent(); super.onStop() }
    override fun onDestroy() { hideContent(); LockScreenController.detach(this); super.onDestroy() }
}
