package cn.toside.music.mobile.vinyl

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun SongInfo(state: VinylPlayerState, onAction: PlayerAction) {
    val favoriteScale by animateFloatAsState(if (state.favorite) 1.1f else 1f, tween(180), label = "favorite")
    Row(Modifier.fillMaxWidth().padding(start = 24.dp, end = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f).padding(end = 8.dp)) {
            BasicText(state.title.ifBlank { "还没有播放的歌曲" }, maxLines = 1, overflow = TextOverflow.Ellipsis,
                style = TextStyle(color = VinylPalette.White, fontSize = 20.sp, fontWeight = FontWeight.SemiBold))
            ArtistLink(state, onAction)
        }
        PlayerIconButton(PlayerIcon.Heart, if (state.favorite) "取消喜欢" else "喜欢", 24,
            enabled = state.hasTrack, color = if (state.favorite) VinylPalette.Red else VinylPalette.Muted,
            modifier = Modifier.graphicsLayer { scaleX = favoriteScale; scaleY = favoriteScale }, selected = state.favorite) {
            onAction("favorite", 0.0)
        }
        PlayerIconButton(PlayerIcon.Comment, "歌曲评论", 24, state.hasTrack && !state.demo, color = VinylPalette.Muted) { onAction("comment", 0.0) }
    }
}

@Composable
internal fun ArtistLink(state: VinylPlayerState, onAction: PlayerAction, modifier: Modifier = Modifier) {
    Row(modifier.heightIn(min = 44.dp)
        .semantics { contentDescription = "查看歌手：${state.artist.ifBlank { "未知歌手" }}" }
        .clickable(enabled = state.hasTrack && !state.demo, role = Role.Button) { onAction("artist", 0.0) },
        verticalAlignment = Alignment.CenterVertically) {
        BasicText(state.artist.ifBlank { "未知歌手" }, modifier = Modifier.weight(1f, fill = false), maxLines = 1,
            overflow = TextOverflow.Ellipsis, style = TextStyle(color = VinylPalette.Muted, fontSize = 15.sp))
        if (state.hasTrack && !state.demo) BasicText("›", modifier = Modifier.padding(start = 6.dp, end = 8.dp),
            style = TextStyle(color = VinylPalette.Muted, fontSize = 22.sp))
    }
}
