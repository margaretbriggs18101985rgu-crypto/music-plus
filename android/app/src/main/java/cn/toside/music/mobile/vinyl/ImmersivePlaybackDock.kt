package cn.toside.music.mobile.vinyl

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImagePainter

/** The same lyric-stage dock in both orientations, with reachable native controls. */
@Composable
internal fun ImmersivePlaybackDock(state: VinylPlayerState, artwork: AsyncImagePainter, landscape: Boolean,
    onHide: (() -> Unit)?, onAction: PlayerAction) {
    Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp).widthIn(max = 980.dp).fillMaxWidth()
        .semantics { contentDescription = "播放控制栏" }
        .then(if (onHide != null) Modifier.clickable(interactionSource = remember { MutableInteractionSource() },
            indication = null, onClickLabel = "隐藏播放控制栏", onClick = onHide) else Modifier)
        .padding(horizontal = 8.dp, vertical = 4.dp)) {
        if (landscape) {
            PlaybackProgress(state, onAction, compact = true)
            Row(Modifier.fillMaxWidth().padding(bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                    DockTrackInfo(state, artwork, Modifier.widthIn(max = 240.dp), onAction)
                }
                Box(Modifier.width(268.dp)) { PlaybackControls(state, onAction, compact = true) }
                Row(Modifier.weight(1f), horizontalArrangement = Arrangement.End) { DockActions(state, onAction) }
            }
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
private fun DockTrackInfo(state: VinylPlayerState, artwork: AsyncImagePainter, modifier: Modifier, onAction: PlayerAction) {
    Row(modifier.heightIn(min = 56.dp).padding(start = 4.dp, end = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(40.dp).clip(RoundedCornerShape(10.dp)).background(Color(0xFF24212B)), contentAlignment = Alignment.Center) {
            if (state.artwork != null && artwork.state !is AsyncImagePainter.State.Error) {
                Image(artwork, contentDescription = "专辑封面", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            } else BasicText("M++", style = TextStyle(color = VinylPalette.Muted, fontSize = 10.sp))
        }
        Column(Modifier.weight(1f).padding(start = 10.dp).heightIn(min = 48.dp)
            .semantics { contentDescription = "查看歌手：${state.artist.ifBlank { "未知歌手" }}" }
            .clickable(enabled = state.hasTrack && !state.demo, role = Role.Button) { onAction("artist", 0.0) },
            verticalArrangement = Arrangement.Center) {
            BasicText(state.title.ifBlank { "暂无播放歌曲" }, maxLines = 1, overflow = TextOverflow.Ellipsis,
                style = TextStyle(color = VinylPalette.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold))
            BasicText(state.artist.ifBlank { "未知歌手" }, maxLines = 1, overflow = TextOverflow.Ellipsis,
                style = TextStyle(color = VinylPalette.Muted, fontSize = 10.sp))
            BasicText("${formatPlayerTime(state.position)} / ${formatPlayerTime(state.duration.takeIf { it > 0 } ?: Double.NaN)}",
                maxLines = 1, style = TextStyle(color = VinylPalette.Muted, fontSize = 9.sp))
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
