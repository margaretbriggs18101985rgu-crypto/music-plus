package cn.toside.music.mobile.vinyl

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import cn.toside.music.mobile.vinyl.PageText as BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun PlayerTopNavigation(state: VinylPlayerState, onAction: PlayerAction, showTitle: Boolean = true,
    landscape: Boolean = false, locked: Boolean = false, onToggleLock: () -> Unit = {}) {
    Box(Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 8.dp), contentAlignment = Alignment.Center) {
        if (showTitle) Column(Modifier.fillMaxWidth().padding(horizontal = 72.dp).heightIn(min = 48.dp),
            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            BasicText(if (state.hasTrack) state.title else "正在播放", maxLines = 1, overflow = TextOverflow.Ellipsis,
                style = TextStyle(color = VinylPalette.White, fontSize = 15.sp, fontWeight = FontWeight.Medium))
            if (state.lyricsVisible && state.hasTrack) {
                Spacer(Modifier.height(5.dp))
                BasicText(state.artist.ifBlank { "未知歌手" }, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    style = TextStyle(color = VinylPalette.Muted, fontSize = 12.sp))
            }
        }
        PlayerIconButton(PlayerIcon.Back, "收起播放器", 24, modifier = Modifier.align(Alignment.CenterStart).width(64.dp).height(48.dp).rotate(-90f)) { onAction("back", 0.0) }
        Row(Modifier.align(Alignment.CenterEnd), verticalAlignment = Alignment.CenterVertically) {
            if (landscape) PlayerIconButton(PlayerIcon.Lock,
                if (locked) "解锁界面" else "锁定界面", 20, color = VinylPalette.Muted,
                modifier = Modifier.width(48.dp).height(48.dp)) { onToggleLock() }
            PlayerIconButton(PlayerIcon.More, "更多播放设置", 22, color = VinylPalette.Muted,
                modifier = Modifier.width(56.dp).height(48.dp)) { onAction("settings", 0.0) }
        }
    }
}

@Composable
internal fun PlayerViewSwitch(state: VinylPlayerState, onAction: PlayerAction) {
    BoxWithConstraints(Modifier.fillMaxWidth().height(52.dp), contentAlignment = Alignment.CenterStart) {
        PlayerIconButton(PlayerIcon.Info, "歌曲信息", 22, state.hasTrack && !state.demo, color = VinylPalette.Muted,
            modifier = Modifier.offset(x = maxWidth / 3 - 24.dp)) { onAction("info", 0.0) }
        PlayerIconButton(PlayerIcon.Download, "下载歌曲", 23, state.hasTrack && !state.demo, color = VinylPalette.Muted,
            modifier = Modifier.offset(x = maxWidth * 2 / 3 - 24.dp)) { onAction("download", 0.0) }
        PlayerIconButton(PlayerIcon.More, "更多播放设置", 23, color = VinylPalette.Muted,
            modifier = Modifier.offset(x = maxWidth * .88f - 24.dp).rotate(90f)) { onAction("settings", 0.0) }
    }
}
