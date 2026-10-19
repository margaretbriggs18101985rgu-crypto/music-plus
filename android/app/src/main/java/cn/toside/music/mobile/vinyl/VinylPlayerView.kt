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
        fun string(key: String, fallback: String = "") = if (map.hasKey(key) && !map.isNull(key)) map.getString(key) ?: fallback else fallback
        fun number(key: String) = if (map.hasKey(key) && !map.isNull(key)) map.getDouble(key) else 0.0
        fun bool(key: String, fallback: Boolean = false) = if (map.hasKey(key) && map.getType(key) == ReadableType.Boolean) map.getBoolean(key) else fallback
        val visuals = if (map.hasKey("reactiveVisuals") && map.getType("reactiveVisuals") == ReadableType.Map) map.getMap("reactiveVisuals") else null
        fun visualNumber(key: String, fallback: Float, min: Float, max: Float): Float {
            val value = if (visuals?.hasKey(key) == true && visuals.getType(key) == ReadableType.Number) visuals.getDouble(key).toFloat() else fallback
            return if (value.isFinite()) value.coerceIn(min, max) else fallback
        }
        fun visualBool(key: String, fallback: Boolean) = if (visuals?.hasKey(key) == true && visuals.getType(key) == ReadableType.Boolean) visuals.getBoolean(key) else fallback
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
            reactiveVisuals = ReactiveVisuals(
                intensity = visualNumber("intensity", 0.85f, 0.00f, 2.00f),
                depth = visualNumber("depth", 0.20f, 0.00f, 1.00f),
                coverResolution = visualNumber("coverResolution", 512.00f, 64.00f, 512.00f).toInt(),
                cinema = visualNumber("cinema", 0.50f, 0.00f, 1.50f),
                particleSize = visualNumber("particleSize", 1.00f, 0.30f, 3.00f),
                speed = visualNumber("speed", 1.00f, 0.00f, 3.00f),
                twist = visualNumber("twist", 0.00f, 0.00f, 2.00f),
                colorTension = visualNumber("colorTension", 1.10f, 0.00f, 2.00f),
                bloom = visualNumber("bloom", 0.62f, 0.00f, 1.50f),
                scatter = visualNumber("scatter", 0.00f, 0.00f, 1.00f),
                backgroundDim = visualNumber("backgroundDim", 0.20f, 0.00f, 1.00f),
                terrainHeight = visualNumber("terrainHeight", 0.55f, 0.00f, 1.50f),
                terrainDepth = visualNumber("terrainDepth", 0.60f, 0.00f, 1.00f),
                terrainOffset = visualNumber("terrainOffset", 0.78f, 0.40f, 1.00f),
                kickSensitivity = visualNumber("kickSensitivity", 1.00f, 0.40f, 2.00f),
                kickLowHz = visualNumber("kickLowHz", 45.00f, 25.00f, 110.00f),
                kickHighHz = visualNumber("kickHighHz", 170.00f, 120.00f, 300.00f),
                bassWeight = visualNumber("bassWeight", 1.00f, 0.00f, 2.00f),
                midWeight = visualNumber("midWeight", 0.65f, 0.00f, 2.00f),
                trebleWeight = visualNumber("trebleWeight", 0.45f, 0.00f, 2.00f),
                cinemaEnabled = visualBool("cinemaEnabled", true),
                particleGlow = visualBool("particleGlow", false),
                outlineHighlight = visualBool("outlineHighlight", false),
                starRiver = visualBool("starRiver", true),
                terrainEnabled = visualBool("terrainEnabled", false),
                spectrumEnabled = visualBool("spectrumEnabled", false),
                kickAuto = visualBool("kickAuto", true),
            ),
            particleQuality = if (map.hasKey("particleQuality") && map.getType("particleQuality") == ReadableType.String) string("particleQuality", "auto") else "auto",
            lyricMotionEnabled = bool("lyricMotionEnabled", true),
            lyricPulseEnabled = bool("lyricPulseEnabled", true),
            lyricDisplayMode = string("lyricDisplayMode", "single").let { if (it == "multiple") it else "single" },
            lyricColor = string("lyricColor", "#A8F6FF"),
            lyricFontSize = if (map.hasKey("lyricFontSize")) number("lyricFontSize").toFloat().let { if (it.isFinite()) it.coerceIn(16f, 56f) else 40f } else 40f,
            lyricFontFamily = normalizeLyricFont(string("lyricFontFamily", "system")),
            pageFontFamily = normalizeLyricFont(string("pageFontFamily", "system")),
            pageFontColor = string("pageFontColor"),
            lyricAlign = string("lyricAlign", "center"),
            backgroundMotion = bool("backgroundMotion", true),
            respectReducedMotion = bool("respectReducedMotion", true),
            wallpaperPath = string("wallpaperPath"),
            wallpaperKind = string("wallpaperKind", "none"),
            wallpaperScope = string("wallpaperScope", "all"),
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
