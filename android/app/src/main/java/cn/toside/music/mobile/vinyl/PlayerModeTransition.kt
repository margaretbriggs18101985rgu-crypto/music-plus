package cn.toside.music.mobile.vinyl

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.invisibleToUser

/** Two boolean keys: at most one lyric list and one record, including rapid reversals. */
@Composable
internal fun PlayerModeTransition(lyricsVisible: Boolean, motion: Boolean, modifier: Modifier,
    content: @Composable (lyrics: Boolean, current: Boolean) -> Unit) {
    Crossfade(targetState = lyricsVisible, modifier = modifier, animationSpec = tween(if (motion) 300 else 0),
        label = "player visual mode") { lyrics ->
        val current = lyrics == lyricsVisible
        Box(Modifier.fillMaxSize().then(if (current) Modifier else Modifier.clearAndSetSemantics { invisibleToUser() })) {
            content(lyrics, current)
        }
    }
}
