package cn.toside.music.mobile.vinyl

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.invisibleToUser

/** Two boolean keys: at most one lyric list and one record, including rapid reversals. */
@Composable
@OptIn(androidx.compose.animation.ExperimentalAnimationApi::class)
internal fun PlayerModeTransition(lyricsVisible: Boolean, motion: Boolean, modifier: Modifier,
    content: @Composable (lyrics: Boolean, current: Boolean) -> Unit) {
    val transition = updateTransition(lyricsVisible, label = "player visual mode")
    val depth = transition.animateFloat(transitionSpec = { tween(if (motion) 620 else 0, easing = CubicBezierEasing(.22f, 1f, .36f, 1f)) },
        label = "player mode depth") { if (it) 1f else 0f }
    transition.Crossfade(modifier = modifier, animationSpec = tween(if (motion) 500 else 0)) { lyrics ->
        val current = lyrics == lyricsVisible
        Box(Modifier.fillMaxSize().graphicsLayer {
            val distance = if (lyrics) 1f - depth.value else depth.value
            scaleX = 1f - distance * .055f
            scaleY = scaleX
            translationY = distance * (if (lyrics) 14.dp.toPx() else -10.dp.toPx())
        }.then(if (current) Modifier else Modifier.clearAndSetSemantics { invisibleToUser() })) {
            content(lyrics, current)
        }
    }
}
