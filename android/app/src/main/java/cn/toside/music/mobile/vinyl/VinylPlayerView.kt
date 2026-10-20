package cn.toside.music.mobile.vinyl

import android.view.View
import android.widget.FrameLayout
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter

/** Retains angle when React Navigation temporarily removes/recreates the player surface. */
private object VinylVisualMemory { val clock = VinylRotationClock() }

class VinylPlayerView(context: ThemedReactContext) : FrameLayout(context) {
    private val playerState = mutableStateOf(VinylPlayerState())
    private val composeView = ComposeView(context).apply {
        setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
        setContent {
            PageTypographyScope(playerState.value) {
              PlayerScreen(playerState.value, VinylVisualMemory.clock) { action, value ->
                val event = Arguments.createMap().apply {
                    putString("action", action)
                    putDouble("value", value)
                }
                (context as ReactContext).getJSModule(RCTEventEmitter::class.java)
                    .receiveEvent(this@VinylPlayerView.id, "topPlayerAction", event)
              }
            }
        }
    }

    init {
        registerLyricPreviewFonts(context)
        // React Navigation owns the activity; explicitly supply its owners to Compose.
        (context.currentActivity as? LifecycleOwner)?.let { setViewTreeLifecycleOwner(it) }
        (context.currentActivity as? SavedStateRegistryOwner)?.let { setViewTreeSavedStateRegistryOwner(it) }
        addView(composeView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        ViewCompat.setOnApplyWindowInsetsListener(this) { _, insets ->
            updateSafeArea(insets)
            insets
        }
    }

    fun updatePlayer(map: ReadableMap?) {
        if (map == null) return
        playerState.value = decodeVinylPlayerState(map)
        updateSafeArea()
    }

    // RN 0.73 caches StatusBar.currentHeight; use current window geometry after a
    // density/cutout change. RNN may already exclude the bottom navigation bar.
    private fun updateSafeArea(insets: WindowInsetsCompat? = ViewCompat.getRootWindowInsets(this)) {
        if (insets == null || width == 0 || height == 0) return
        val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
        val stableBars = insets.getInsetsIgnoringVisibility(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
        // RNN can consume the status-bar inset during an orientation transition.
        // Its window keeps the status bar visible; retain the platform height as
        // a fallback, then subtract this view's actual window offset below.
        val statusHeightId = resources.getIdentifier("status_bar_height", "dimen", "android")
        val statusHeight = if (statusHeightId != 0) resources.getDimensionPixelSize(statusHeightId) else 0
        val position = IntArray(2)
        val rootPosition = IntArray(2)
        getLocationInWindow(position)
        rootView.getLocationInWindow(rootPosition)
        val density = resources.displayMetrics.density
        val top = (rootPosition[1] + maxOf(bars.top, stableBars.top, statusHeight) - position[1]).coerceAtLeast(0) / density
        val bottom = (position[1] + height - (rootPosition[1] + rootView.height - bars.bottom)).coerceAtLeast(0) / density
        val start = (rootPosition[0] + bars.left - position[0]).coerceAtLeast(0) / density
        val end = (position[0] + width - (rootPosition[0] + rootView.width - bars.right)).coerceAtLeast(0) / density
        if (playerState.value.topInset != top || playerState.value.bottomInset != bottom ||
            playerState.value.startInset != start || playerState.value.endInset != end) {
            playerState.value = playerState.value.copy(topInset = top, bottomInset = bottom, startInset = start, endInset = end)
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        ViewCompat.requestApplyInsets(this)
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        composeView.measure(View.MeasureSpec.makeMeasureSpec(right - left, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(bottom - top, View.MeasureSpec.EXACTLY))
        composeView.layout(0, 0, right - left, bottom - top)
        updateSafeArea()
    }

    fun dispose() { composeView.disposeComposition() }
}

class VinylPlayerViewManager : SimpleViewManager<VinylPlayerView>() {
    override fun getName() = "LXVinylPlayer"
    override fun createViewInstance(context: ThemedReactContext) = VinylPlayerView(context)
    @ReactProp(name = "playerState")
    fun setPlayerState(view: VinylPlayerView, state: ReadableMap?) = view.updatePlayer(state)
    override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
        mutableMapOf("topPlayerAction" to mapOf("registrationName" to "onPlayerAction"))
    override fun onDropViewInstance(view: VinylPlayerView) { view.dispose(); super.onDropViewInstance(view) }
}
