package cn.toside.music.mobile.vinyl

import android.content.Context
import android.content.ContextWrapper
import android.net.Uri
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import java.io.File
import java.util.LinkedHashSet

private object WallpaperPlaybackRegistry {
    private val views = LinkedHashSet<WallpaperView>()

    fun attach(view: WallpaperView) {
        views.remove(view)
        views.add(view)
        refresh()
    }

    fun detach(view: WallpaperView) {
        views.remove(view)
        refresh()
    }

    fun refresh() {
        val active = views.filter { it.canPlayVideo }.maxByOrNull { it.playbackPriority }
        views.forEach { it.setPlaybackEnabled(it === active) }
    }
}

/** Media3-backed view used for imported video wallpapers. */
class WallpaperView(context: Context) : FrameLayout(context) {
    private val player = ExoPlayer.Builder(context.applicationContext).build()
    private val playerView = PlayerView(context).apply {
        useController = false
        resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
        setShutterBackgroundColor(android.graphics.Color.TRANSPARENT)
        player = this@WallpaperView.player
        layoutParams = LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    }
    private var currentPath = ""
    private var currentKind = "none"
    private var loadedPath = ""
    private var attached = false
    private var hostResumed = true
    private var released = false
    internal var playbackPriority = 0
        set(value) { field = value; WallpaperPlaybackRegistry.refresh() }
    internal val canPlayVideo: Boolean get() = attached && hostResumed && currentKind == "video" && currentPath.isNotBlank()
    private val lifecycleOwner = findLifecycleOwner(context)
    private val lifecycleObserver = LifecycleEventObserver { _, _ ->
        hostResumed = lifecycleOwner?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.RESUMED) ?: true
        WallpaperPlaybackRegistry.refresh()
    }

    init {
        addView(playerView)
        player.repeatMode = Player.REPEAT_MODE_ALL
        player.volume = 0f
    }

    private fun refreshWallpaper() {
        if (currentKind != "video" || currentPath.isBlank()) {
            player.pause()
            WallpaperPlaybackRegistry.refresh()
            return
        }
        if (loadedPath == currentPath) {
            WallpaperPlaybackRegistry.refresh()
            return
        }
        loadedPath = currentPath
        val uri = if (currentPath.startsWith("/")) Uri.fromFile(File(currentPath)) else Uri.parse(currentPath)
        player.setMediaItem(MediaItem.fromUri(uri))
        player.prepare()
        WallpaperPlaybackRegistry.refresh()
    }

    fun setPath(path: String) {
        if (path == currentPath) return
        currentPath = path
        refreshWallpaper()
    }

    fun setKind(kind: String) {
        if (kind == currentKind) return
        currentKind = kind
        refreshWallpaper()
    }

    internal fun setPlaybackEnabled(enabled: Boolean) {
        if (released) return
        player.playWhenReady = enabled
    }

    fun release() {
        if (released) return
        released = true
        WallpaperPlaybackRegistry.detach(this)
        lifecycleOwner?.lifecycle?.removeObserver(lifecycleObserver)
        playerView.player = null
        player.release()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        attached = true
        hostResumed = lifecycleOwner?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.RESUMED) ?: true
        lifecycleOwner?.lifecycle?.addObserver(lifecycleObserver)
        WallpaperPlaybackRegistry.attach(this)
    }

    override fun onDetachedFromWindow() {
        attached = false
        lifecycleOwner?.lifecycle?.removeObserver(lifecycleObserver)
        WallpaperPlaybackRegistry.detach(this)
        player.pause()
        super.onDetachedFromWindow()
    }
}

private fun findLifecycleOwner(context: Context): LifecycleOwner? {
    var current: Context? = context
    while (current != null) {
        if (current is LifecycleOwner) return current
        current = (current as? ContextWrapper)?.baseContext
    }
    return null
}

class WallpaperViewManager : SimpleViewManager<WallpaperView>() {
    override fun getName() = "LXWallpaperView"
    override fun createViewInstance(context: ThemedReactContext) = WallpaperView(context)

    @ReactProp(name = "path")
    fun setPath(view: WallpaperView, path: String?) = view.setPath(path ?: "")

    @ReactProp(name = "kind")
    fun setKind(view: WallpaperView, kind: String?) = view.setKind(kind ?: "none")

    override fun onDropViewInstance(view: WallpaperView) { view.release(); super.onDropViewInstance(view) }
}
