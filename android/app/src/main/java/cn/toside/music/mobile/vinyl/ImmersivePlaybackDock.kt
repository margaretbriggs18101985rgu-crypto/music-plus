package cn.toside.music.mobile.vinyl

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** The same lyric-stage dock in both orientations, with reachable native controls. */
@Composable
internal fun ImmersivePlaybackDock(state: VinylPlayerState, landscape: Boolean, onAction: PlayerAction, onBlankTap: () -> Unit = {}) {
    Column(Modifier.clickable(interactionSource = MutableInteractionSource(), indication = null, onClick = onBlankTap)
        .padding(horizontal = 12.dp, vertical = 8.dp).widthIn(max = 980.dp).fillMaxWidth()
        .semantics { contentDescription = "播放控制栏" }
        .padding(horizontal = 8.dp, vertical = 4.dp)) {
        if (landscape) {
            PlaybackProgress(state, onAction, compact = true)
            LandscapePlaybackControls(state, onAction)
        } else {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                ArtistLink(state, onAction, Modifier.weight(1f).padding(start = 16.dp, end = 8.dp))
                DockActions(state, onAction)
            }
            // Retain the original portrait seek labels and five-button proportions.
            PlaybackProgress(state, onAction)
            PlaybackControls(state, onAction)
        }
    }
}

@Composable
private fun DockActions(state: VinylPlayerState, onAction: PlayerAction) {
    PlayerIconButton(PlayerIcon.Heart, if (state.favorite) "取消喜欢" else "喜欢", 21, state.hasTrack,
        color = if (state.favorite) VinylPalette.Red else VinylPalette.Muted, selected = state.favorite) { onAction("favorite", 0.0) }
    PlayerIconButton(PlayerIcon.Comment, "歌曲评论", 21, state.hasTrack && !state.demo, color = VinylPalette.Muted) { onAction("comment", 0.0) }
    PlayerIconButton(PlayerIcon.More, "更多播放设置", 21, color = VinylPalette.Muted,
        modifier = Modifier.rotate(90f)) { onAction("settings", 0.0) }
}
