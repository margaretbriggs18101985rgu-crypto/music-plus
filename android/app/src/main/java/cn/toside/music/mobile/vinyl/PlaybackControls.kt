package cn.toside.music.mobile.vinyl

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
internal fun LandscapePlaybackControls(state: VinylPlayerState, onAction: PlayerAction) {
    Row(Modifier.fillMaxWidth().height(64.dp).padding(horizontal = 4.dp),
        horizontalArrangement = Arrangement.SpaceAround, verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
            PlayerIconButton(PlayerIcon.Previous, "上一首", 28, state.hasTrack) { onAction("previous", 0.0) }
        }
        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
            PlayerIconButton(if (state.isPlaying) PlayerIcon.Pause else PlayerIcon.Play,
                if (state.demo) { if (state.isPlaying) "暂停演示动画" else "继续演示动画" }
                else if (state.isPlaying) "暂停" else "播放", 24, state.hasTrack) { onAction("toggle", 0.0) }
        }
        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
            PlayerIconButton(PlayerIcon.Next, "下一首", 28, state.hasTrack) { onAction("next", 0.0) }
        }
        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
            PlayerIconButton(PlayerIcon.Heart, if (state.favorite) "取消喜欢" else "喜欢", 26, state.hasTrack,
                color = if (state.favorite) VinylPalette.Red else VinylPalette.White, selected = state.favorite) { onAction("favorite", 0.0) }
        }
    }
}

@Composable
internal fun PlaybackControls(state: VinylPlayerState, onAction: PlayerAction, compact: Boolean = false) {
    Row(Modifier.fillMaxWidth().height(if (compact) 64.dp else 92.dp).padding(horizontal = if (compact) 4.dp else 12.dp),
        horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
        val mode = when (state.playMode) { "random" -> PlayerIcon.Shuffle; "singleLoop" -> PlayerIcon.RepeatOne; "list" -> PlayerIcon.Order; "none" -> PlayerIcon.Single; else -> PlayerIcon.Repeat }
        PlayerIconButton(mode, "播放模式", 24) { onAction("mode", 0.0) }
        PlayerIconButton(PlayerIcon.Previous, "上一首", 27, state.hasTrack) { onAction("previous", 0.0) }
        PlayerIconButton(if (state.isPlaying) PlayerIcon.Pause else PlayerIcon.Play,
            if (state.demo) { if (state.isPlaying) "暂停演示动画" else "继续演示动画" }
            else { if (state.isPlaying) "暂停" else "播放" },
            if (compact) 32 else 40, state.hasTrack, modifier = Modifier.size(if (compact) 64.dp else 72.dp)) { onAction("toggle", 0.0) }
        PlayerIconButton(PlayerIcon.Next, "下一首", 27, state.hasTrack) { onAction("next", 0.0) }
        PlayerIconButton(PlayerIcon.Menu, "播放队列", 24, state.hasTrack) { onAction("queue", 0.0) }
    }
}
