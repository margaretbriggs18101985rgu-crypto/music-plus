package cn.toside.music.mobile.vinyl

import android.app.AlertDialog
import android.content.Intent
import android.util.Log
import android.os.Bundle
import android.view.View
import android.graphics.Color
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.platform.ComposeView
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import cn.toside.music.mobile.R
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

/** Debug-only, explicitly labelled animation harness; does not manufacture audio progress. */
class VinylPreviewActivity : AppCompatActivity() {
    private val clock = VinylRotationClock()
    private val visualConfig = mutableStateOf(ImmersiveVisualConfig())
    private val state = mutableStateOf(VinylPlayerState(
        trackId = "visual-demo", title = "午后的唱片", artist = "界面演示 · 非音频播放",
        hasTrack = true, isStopped = false, demo = true, favorite = true,
    ))

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        state.value = state.value.copy(artwork = "android.resource://$packageName/${R.drawable.vinyl_demo_cover}")
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        val content = ComposeView(this).apply {
            setContent { PlayerScreen(state.value, clock, visualConfig.value, ::handleAction) }
        }
        setContentView(content)
        ViewCompat.setOnApplyWindowInsetsListener(content) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val density = resources.displayMetrics.density
            state.value = state.value.copy(topInset = bars.top / density, bottomInset = bars.bottom / density)
            insets
        }
        ViewCompat.requestApplyInsets(content)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Debug harness commands only, for reproducible on-device animation verification.
        val action = intent.getStringExtra("vinyl_action") ?: return
        if (action in setOf("snapshot", "toggle", "refresh", "buffer", "stop", "resume", "empty", "lyrics", "ambient-red", "ambient-blue", "ambient-white", "ambient-missing", "ambient-invalid", "ambient-off", "ambient-low", "ambient-high", "ambient-auto")) handleAction(action, 0.0)
    }

    private fun handleAction(action: String, value: Double) {
        when (action) {
            "lyrics" -> state.value = state.value.copy(lyricsVisible = if (value == 0.0) !state.value.lyricsVisible else value == 1.0)
            // Solid-color fixtures test palette/failure behavior only; no audio or lyric data is injected.
            "ambient-red", "ambient-blue", "ambient-white", "ambient-missing", "ambient-invalid" -> {
                val resource = when (action) {
                    "ambient-red" -> R.drawable.ambient_test_red
                    "ambient-blue" -> R.drawable.ambient_test_blue
                    "ambient-white" -> R.drawable.ambient_test_white
                    else -> null
                }
                state.value = state.value.copy(trackId = "visual-demo-$action",
                    artwork = resource?.let { "android.resource://$packageName/$it" }
                        ?: if (action == "ambient-invalid") "file:///nonexistent/ambient-cover.png" else null)
            }
            "ambient-off", "ambient-low", "ambient-high", "ambient-auto" -> visualConfig.value = visualConfig.value.copy(
                visualEffectsEnabled = action != "ambient-off",
                particleQuality = when (action) {
                    "ambient-low" -> ParticleQuality.Low
                    "ambient-high" -> ParticleQuality.High
                    else -> ParticleQuality.Auto
                })
            "snapshot" -> Log.i("VinylPreview", "demo=true angle=${clock.angle} playing=${state.value.isPlaying}")
            "refresh" -> state.value = state.value.copy(artist = "界面演示 · 状态刷新 ${System.currentTimeMillis() % 10000}")
            "buffer" -> state.value = state.value.copy(isPlaying = false, isStopped = false)
            "stop" -> state.value = state.value.copy(isPlaying = false, isStopped = true)
            "resume" -> state.value = state.value.copy(isPlaying = true, hasTrack = true, isStopped = false)
            "empty" -> state.value = state.value.copy(hasTrack = false, isPlaying = false, isStopped = true, artwork = null,
                title = "还没有播放的歌曲", artist = "从搜索或我的音乐中选择一首歌曲")
            "toggle" -> state.value = state.value.copy(isPlaying = !state.value.isPlaying)
            "topTab" -> if (value == 2.0) VinylNavigation.open(this, "nav_love")
            "bottomTab" -> VinylNavigation.open(this, arrayOf("home", "nav_search", "nav_love", "nav_setting")[value.toInt()])
            "search" -> VinylNavigation.open(this, "nav_search")
            "menu" -> AlertDialog.Builder(this).setTitle("黑胶演示")
                .setItems(arrayOf("返回正式应用", "演示工具", "关闭演示")) { _, index ->
                    when (index) {
                        0 -> VinylNavigation.open(this, "home")
                        1 -> handleAction("more", 0.0)
                        else -> finish()
                    }
                }.show()
            "favorite" -> state.value = state.value.copy(favorite = !state.value.favorite)
            "next", "previous" -> state.value = state.value.copy(
                trackId = if (state.value.trackId == "visual-demo") "visual-demo-two" else "visual-demo",
                title = if (state.value.title == "午后的唱片") "另一个清晨" else "午后的唱片",
            )
            "more" -> AlertDialog.Builder(this).setTitle("界面演示工具")
                .setItems(arrayOf("切换长标题", "切换空状态", "停止并回针", "恢复演示歌曲", "刷新信息（不中断旋转）", "模拟缓冲（保持落针）")) { _, index ->
                    state.value = when (index) {
                        0 -> state.value.copy(title = "这是一首很长很长的歌曲标题，用来检查窄屏布局和操作区域")
                        1 -> state.value.copy(hasTrack = false, isPlaying = false, isStopped = true, artwork = null,
                            title = "还没有播放的歌曲", artist = "从搜索或我的音乐中选择一首歌曲")
                        2 -> state.value.copy(isPlaying = false, isStopped = true)
                        4 -> state.value.copy(artist = "界面演示 · 状态刷新 ${System.currentTimeMillis() % 10000}")
                        5 -> state.value.copy(isPlaying = false, isStopped = false)
                        else -> state.value.copy(hasTrack = true, isStopped = false, title = "午后的唱片", artist = "界面演示 · 非音频播放")
                    }
                }.show()
        }
    }
}

@Preview(name = "黑胶播放器 · 演示封面", widthDp = 393, heightDp = 852, showBackground = true)
@Composable
fun VinylDemoCoverPreview() {
    PlayerScreen(VinylPlayerState(title = "午后的唱片", artist = "界面演示 · 非音频播放",
        artwork = "android.resource://cn.toside.music.mobile/${R.drawable.vinyl_demo_cover}",
        hasTrack = true, isStopped = false, demo = true, topInset = 28f, bottomInset = 24f))
}
