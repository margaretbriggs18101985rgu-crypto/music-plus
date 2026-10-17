package cn.toside.music.mobile.vinyl

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun PlayerLyrics(state: VinylPlayerState, modifier: Modifier, onAction: PlayerAction) {
    val list = rememberLazyListState()
    // Do not fight the user's scroll; resume following at the next lyric change.
    LaunchedEffect(state.trackId, state.activeLyric) {
        if (!list.isScrollInProgress && state.activeLyric in state.lyrics.indices) list.animateScrollToItem(state.activeLyric)
    }
    if (state.lyrics.isEmpty()) {
        Box(modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            BasicText(if (state.hasTrack) "暂无歌词" else "选择歌曲后显示歌词", style = TextStyle(color = VinylPalette.Muted, fontSize = 18.sp))
        }
    } else BoxWithConstraints(modifier.fillMaxWidth()) {
        LazyColumn(state = list, modifier = Modifier.fillMaxSize().graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
            .drawWithContent {
                drawContent()
                drawRect(Brush.verticalGradient(0f to Color.Transparent, .07f to Color.Black, .88f to Color.Black, 1f to Color.Transparent), blendMode = BlendMode.DstIn)
            }, contentPadding = PaddingValues(top = maxHeight * .28f, bottom = maxHeight * .55f)) {
            itemsIndexed(state.lyrics) { index, line ->
                Column(Modifier.fillMaxWidth().clickable(enabled = state.hasTrack && state.duration > 0, role = Role.Button) { onAction("seek", line.time / 1000.0) }
                    .padding(horizontal = 26.dp, vertical = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    BasicText(line.text, style = TextStyle(color = if (index == state.activeLyric) VinylPalette.White else VinylPalette.Muted.copy(alpha = .65f),
                        fontSize = 21.sp, lineHeight = 31.sp, fontWeight = if (index == state.activeLyric) FontWeight.Medium else FontWeight.Normal, textAlign = TextAlign.Center))
                    if (line.translation.isNotBlank()) BasicText(line.translation, modifier = Modifier.padding(top = 6.dp),
                        style = TextStyle(color = VinylPalette.Muted, fontSize = 14.sp, lineHeight = 22.sp, textAlign = TextAlign.Center))
                }
            }
        }
    }
}
