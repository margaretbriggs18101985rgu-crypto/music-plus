package cn.toside.music.mobile.vinyl

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import androidx.media.session.MediaButtonReceiver
import android.support.v4.media.session.PlaybackStateCompat
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.Collections
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt
import cn.toside.music.mobile.R

internal data class MusicWidgetState(
    val trackId: String = "",
    val title: String = "",
    val artist: String = "",
    val artwork: String = "",
    val artworkUserAgent: String = "",
    val hasTrack: Boolean = false,
    val isPlaying: Boolean = false,
    val position: Double = 0.0,
    val duration: Double = 0.0,
    val seekRevision: Int = 0,
) {
    fun progress() = if (duration > 0.0) (position / duration).coerceIn(0.0, 1.0) else 0.0
}

internal object HomeWidgetController {
    private const val PREFS = "music_home_widget_state"
    private const val PROGRESS_REFRESH_SECONDS = 15.0
    @Volatile private var latestState: MusicWidgetState? = null
    @Volatile private var renderedState: MusicWidgetState? = null

    @Synchronized
    fun update(context: Context, state: MusicWidgetState) {
        val appContext = context.applicationContext
        val previous = renderedState ?: readState(appContext)
        latestState = state
        if (previous != null && !requiresRender(previous, state)) return
        renderedState = state
        writeState(appContext, state)
        updateAll(appContext)
    }

    fun updateAll(context: Context) {
        val appContext = context.applicationContext
        val state = latestState ?: readState(appContext) ?: MusicWidgetState()
        latestState = state
        val manager = AppWidgetManager.getInstance(appContext)
        updateProvider(appContext, manager, CompactMusicWidgetProvider::class.java, R.layout.widget_music_compact, state)
        updateProvider(appContext, manager, FeatureMusicWidgetProvider::class.java, R.layout.widget_music_feature, state)
    }

    fun updateProvider(context: Context, manager: AppWidgetManager, layout: Int, ids: IntArray) {
        val state = latestState ?: readState(context.applicationContext) ?: MusicWidgetState()
        ids.forEach { id -> manager.updateAppWidget(id, createRemoteViews(context, id, layout, state)) }
    }

    private fun updateProvider(context: Context, manager: AppWidgetManager, provider: Class<out AppWidgetProvider>, layout: Int, state: MusicWidgetState) {
        val ids = manager.getAppWidgetIds(ComponentName(context, provider))
        ids.forEach { id -> manager.updateAppWidget(id, createRemoteViews(context, id, layout, state)) }
    }

    private fun requiresRender(previous: MusicWidgetState, next: MusicWidgetState): Boolean =
        previous.trackId != next.trackId || previous.title != next.title || previous.artist != next.artist ||
            previous.artwork != next.artwork || previous.hasTrack != next.hasTrack || previous.isPlaying != next.isPlaying ||
            previous.seekRevision != next.seekRevision || abs(previous.position - next.position) >= PROGRESS_REFRESH_SECONDS ||
            previous.duration != next.duration

    private fun writeState(context: Context, state: MusicWidgetState) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("trackId", state.trackId)
            .putString("title", state.title)
            .putString("artist", state.artist)
            .putString("artwork", state.artwork)
            .putString("artworkUserAgent", state.artworkUserAgent)
            .putBoolean("hasTrack", state.hasTrack)
            .putBoolean("isPlaying", state.isPlaying)
            .putFloat("position", state.position.toFloat())
            .putFloat("duration", state.duration.toFloat())
            .putInt("seekRevision", state.seekRevision)
            .apply()
    }

    private fun readState(context: Context): MusicWidgetState? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.contains("hasTrack")) return null
        return MusicWidgetState(
            trackId = prefs.getString("trackId", "").orEmpty(),
            title = prefs.getString("title", "").orEmpty(),
            artist = prefs.getString("artist", "").orEmpty(),
            artwork = prefs.getString("artwork", "").orEmpty(),
            artworkUserAgent = prefs.getString("artworkUserAgent", "").orEmpty(),
            hasTrack = prefs.getBoolean("hasTrack", false),
            isPlaying = prefs.getBoolean("isPlaying", false),
            position = prefs.getFloat("position", 0f).toDouble(),
            duration = prefs.getFloat("duration", 0f).toDouble(),
            seekRevision = prefs.getInt("seekRevision", 0),
        )
    }
}

private fun createRemoteViews(context: Context, widgetId: Int, layout: Int, state: MusicWidgetState): RemoteViews {
    val views = RemoteViews(context.packageName, layout)
    val hasTrack = state.hasTrack
    views.setTextViewText(R.id.widget_title, if (hasTrack) state.title.ifBlank { "未知歌曲" } else "MUSIC++")
    views.setTextViewText(R.id.widget_artist, if (hasTrack) state.artist.ifBlank { "未知歌手" } else "选择歌曲开始播放")
    views.setContentDescription(R.id.widget_artwork, if (hasTrack) "专辑封面：${state.title}" else "MUSIC++")
    views.setContentDescription(R.id.widget_root, "MUSIC++ 音乐播放器")
    views.setContentDescription(R.id.widget_previous, "上一首")
    views.setContentDescription(R.id.widget_play, if (state.isPlaying) "暂停" else "播放")
    views.setContentDescription(R.id.widget_next, "下一首")
    views.setViewVisibility(R.id.widget_progress, if (hasTrack && state.duration > 0.0) View.VISIBLE else View.INVISIBLE)
    views.setProgressBar(R.id.widget_progress, 1000, (state.progress() * 1000).roundToInt(), false)
    views.setImageViewResource(R.id.widget_play, if (state.isPlaying) R.drawable.ic_widget_pause else R.drawable.ic_widget_play)
    listOf(R.id.widget_previous, R.id.widget_play, R.id.widget_next).forEach {
        views.setBoolean(it, "setEnabled", hasTrack)
        views.setFloat(it, "setAlpha", if (hasTrack) 1f else .45f)
    }
    views.setOnClickPendingIntent(R.id.widget_previous, mediaButton(context, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS))
    views.setOnClickPendingIntent(R.id.widget_play, mediaButton(context, PlaybackStateCompat.ACTION_PLAY_PAUSE))
    views.setOnClickPendingIntent(R.id.widget_next, mediaButton(context, PlaybackStateCompat.ACTION_SKIP_TO_NEXT))
    views.setOnClickPendingIntent(R.id.widget_root, shortcut(context, widgetId, "home"))

    if (layout == R.layout.widget_music_feature) {
        listOf(
            Triple(R.id.shortcut_favorites, "nav_love", "喜欢"),
            Triple(R.id.shortcut_recent, "nav_love_recent", "最近播放"),
            Triple(R.id.shortcut_recommend, "nav_search", "今日推荐"),
            Triple(R.id.shortcut_report, "nav_report", "听歌报告"),
        ).forEach { (viewId, route, label) ->
            views.setOnClickPendingIntent(viewId, shortcut(context, widgetId, route))
            views.setContentDescription(viewId, label)
        }
    }

    val cover = WidgetArtworkCache.get(context, state.artwork, state.artworkUserAgent) { HomeWidgetController.updateAll(context) }
    if (cover != null) views.setImageViewBitmap(R.id.widget_artwork, cover)
    else views.setImageViewResource(R.id.widget_artwork, R.drawable.ic_widget_music)
    return views
}

private fun mediaButton(context: Context, action: Long): PendingIntent? =
    MediaButtonReceiver.buildMediaButtonPendingIntent(context, action)

private fun shortcut(context: Context, widgetId: Int, route: String): PendingIntent {
    val intent = Intent(context, WidgetNavigationReceiver::class.java)
        .setAction("cn.toside.music.mobile.WIDGET_ROUTE.$route")
        .putExtra(WidgetNavigationReceiver.EXTRA_ROUTE, route)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0
    return PendingIntent.getBroadcast(context, widgetId * 31 + route.hashCode(), intent, flags)
}

private object WidgetArtworkCache {
    private const val MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024
    private const val MAX_DIMENSION = 256
    private val executor = Executors.newSingleThreadExecutor()
    private val cache = ConcurrentHashMap<String, Bitmap>()
    private val pending = Collections.newSetFromMap(ConcurrentHashMap<String, Boolean>())

    fun get(context: Context, source: String, userAgent: String, onReady: () -> Unit): Bitmap? {
        if (source.isBlank()) return null
        cache[source]?.let { return it }
        if (pending.add(source)) {
            executor.execute {
                try {
                    val bytes = readArtwork(context.applicationContext, source, userAgent) ?: return@execute
                    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
                    var sample = 1
                    while (max(bounds.outWidth, bounds.outHeight) / sample > MAX_DIMENSION) sample *= 2
                    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
                    if (bitmap != null) {
                        cache[source] = bitmap
                        onReady()
                    }
                } catch (error: Exception) {
                    Log.w("MusicHomeWidget", "Unable to load widget artwork", error)
                } finally {
                    pending.remove(source)
                }
            }
        }
        return null
    }

    private fun readArtwork(context: Context, source: String, userAgent: String): ByteArray? {
        val uri = Uri.parse(source)
        val input = when (uri.scheme?.lowercase()) {
            "file" -> uri.path?.let { FileInputStream(File(it)) }
            "content", "android.resource" -> context.contentResolver.openInputStream(uri)
            "http", "https" -> {
                val connection = URL(source).openConnection() as HttpURLConnection
                connection.connectTimeout = 5000
                connection.readTimeout = 7000
                connection.setRequestProperty("User-Agent", userAgent.ifBlank { "MUSIC++ Android Widget" })
                connection.connect()
                connection.inputStream
            }
            else -> null
        } ?: return null
        return input.use { stream ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(16 * 1024)
            var total = 0
            while (true) {
                val count = stream.read(buffer)
                if (count < 0) break
                total += count
                if (total > MAX_DOWNLOAD_BYTES) return@use null
                output.write(buffer, 0, count)
            }
            output.toByteArray()
        }
    }
}

class CompactMusicWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        HomeWidgetController.updateProvider(context, manager, R.layout.widget_music_compact, ids)
    }
}

class FeatureMusicWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        HomeWidgetController.updateProvider(context, manager, R.layout.widget_music_feature, ids)
    }
}

class WidgetNavigationReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        VinylNavigation.open(context, intent.getStringExtra(EXTRA_ROUTE).orEmpty())
    }

    companion object { const val EXTRA_ROUTE = "widget_route" }
}
