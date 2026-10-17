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
import com.facebook.react.bridge.ReadableType
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

    init {
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
        fun string(key: String, fallback: String = "") = if (map.hasKey(key) && !map.isNull(key)) map.getString(key) ?: fallback else fallback
        fun number(key: String) = if (map.hasKey(key) && !map.isNull(key)) map.getDouble(key) else 0.0
        fun bool(key: String, fallback: Boolean = false) = if (map.hasKey(key) && map.getType(key) == ReadableType.Boolean) map.getBoolean(key) else fallback
        playerState.value = VinylPlayerState(
            trackId = string("trackId"), title = string("title"), artist = string("artist"),
            artwork = string("artwork").ifBlank { null }, isPlaying = bool("isPlaying"),
            artworkUserAgent = string("artworkUserAgent"),
            hasTrack = bool("hasTrack"), isStopped = bool("isStopped"), position = number("position"),
            duration = number("duration"), favorite = bool("favorite"), status = string("status"),
            topInset = number("topInset").toFloat(), bottomInset = number("bottomInset").toFloat(),
            lyricsVisible = bool("lyricsVisible"), activeLyric = number("activeLyric").toInt(), playMode = string("playMode", "listLoop"),
            seekRevision = number("seekRevision").toInt(),
            immersiveVisualsEnabled = bool("immersiveVisualsEnabled", true),
            particleQuality = if (map.hasKey("particleQuality") && map.getType("particleQuality") == ReadableType.String) string("particleQuality", "auto") else "auto",
            lyricMotionEnabled = bool("lyricMotionEnabled", true),
            backgroundMotion = bool("backgroundMotion", true),
            respectReducedMotion = bool("respectReducedMotion", true),
            lyrics = if (map.hasKey("lyrics") && !map.isNull("lyrics")) {
                val lines = map.getArray("lyrics")!!
                // Preserve slots (including duplicate timestamps) so activeLyric keeps its RN index.
                (0 until lines.size()).map { index ->
                    val line = if (lines.getType(index) == ReadableType.Map) lines.getMap(index) else null
                    fun text(key: String) = if (line?.hasKey(key) == true && line.getType(key) == ReadableType.String) line.getString(key) ?: "" else ""
                    val time = if (line?.hasKey("time") == true && line.getType("time") == ReadableType.Number) line.getDouble("time") else Double.NaN
                    VinylLyricLine(time, text("text"), text("translation"))
                }
            } else emptyList(),
        )
        updateSafeArea()
    }

    // RN 0.73 caches StatusBar.currentHeight; use current window geometry after a
    // density/cutout change. RNN may already exclude the bottom navigation bar.
    private fun updateSafeArea(insets: WindowInsetsCompat? = ViewCompat.getRootWindowInsets(this)) {
        if (insets == null || width == 0 || height == 0) return
        val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
        val position = IntArray(2)
        val rootPosition = IntArray(2)
        getLocationInWindow(position)
        rootView.getLocationInWindow(rootPosition)
        val density = resources.displayMetrics.density
        val top = (rootPosition[1] + bars.top - position[1]).coerceAtLeast(0) / density
        val bottom = (position[1] + height - (rootPosition[1] + rootView.height - bars.bottom)).coerceAtLeast(0) / density
        if (playerState.value.topInset != top || playerState.value.bottomInset != bottom) {
            playerState.value = playerState.value.copy(topInset = top, bottomInset = bottom)
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
