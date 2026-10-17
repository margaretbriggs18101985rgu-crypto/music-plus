package cn.toside.music.mobile.vinyl

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.abs

@Composable
internal fun PlayerLyrics(
    state: VinylPlayerState,
    modifier: Modifier,
    onAction: PlayerAction,
    motionEnabled: Boolean = true,
    horizontalDrag: Boolean = false,
) = key(state.trackId) {
    val list = rememberLazyListState()
    val manualDrag by list.interactionSource.collectIsDraggedAsState()
    var browsing by remember { mutableStateOf(false) }
    var followRequest by remember { mutableIntStateOf(0) }
    LaunchedEffect(manualDrag) { if (manualDrag) browsing = true }
    // Real seeks (including the progress bar) resume follow, even within the same lyric line.
    LaunchedEffect(state.seekRevision) { browsing = false; followRequest++ }
    LaunchedEffect(state.activeLyric, state.lyrics.size, browsing, followRequest, horizontalDrag, motionEnabled) {
        if (!browsing && !manualDrag && !horizontalDrag && state.activeLyric in state.lyrics.indices) {
            if (motionEnabled) list.animateScrollToItem(state.activeLyric)
            else list.scrollToItem(state.activeLyric)
        }
    }
    if (state.lyrics.isEmpty()) {
        Box(modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            BasicText(if (state.hasTrack) "暂无歌词" else "选择歌曲后显示歌词",
                style = TextStyle(color = VinylPalette.Muted, fontSize = 18.sp))
        }
    } else BoxWithConstraints(modifier.fillMaxWidth()) {
        val fontScale = LocalDensity.current.fontScale
        val baseFont = if (maxWidth < 360.dp || fontScale >= 1.3f) 30f else 34f
        LazyColumn(state = list, userScrollEnabled = !horizontalDrag,
            modifier = Modifier.fillMaxSize().graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
                .drawWithContent {
                    drawContent()
                    drawRect(Brush.verticalGradient(0f to Color.Transparent, .10f to Color.Black, .87f to Color.Black, 1f to Color.Transparent), blendMode = BlendMode.DstIn)
                }, contentPadding = PaddingValues(top = maxHeight * .32f, bottom = maxHeight * .62f)) {
            itemsIndexed(state.lyrics) { index, line ->
                val active = index == state.activeLyric
                val distance = abs(index - state.activeLyric).coerceAtMost(4)
                val opacity = if (active) 1f else (.63f - distance * .09f).coerceAtLeast(.27f)
                val entrance = rememberLyricEntrance(active, state.isPlaying, motionEnabled)
                val seek = lyricSeekAtIndex(state.lyrics, index, state.duration, state.hasTrack)
                val font = if (line.text.length > 64) minOf(baseFont, 30f) else baseFont
                Column(Modifier.fillMaxWidth().semantics { selected = active }
                    .clickable(enabled = seek != null && line.text.isNotBlank(), role = Role.Button) {
                        seek?.let { onAction("seek", it) }
                    }.padding(horizontal = 56.dp, vertical = 18.dp)
                    .graphicsLayer {
                        val scale = if (active) entrance.value else 1f
                        scaleX = scale; scaleY = scale
                        translationY = if (active) (1f - scale) * 240.dp.toPx() else 0f
                    }, horizontalAlignment = Alignment.CenterHorizontally) {
                    // Stable measured text geometry prevents emphasis from reflowing every row.
                    BasicText(line.text, modifier = Modifier.fillMaxWidth().graphicsLayer {
                        val emphasis = if (active) 1f else (.69f - distance * .015f)
                        scaleX = emphasis; scaleY = emphasis
                    }, style = TextStyle(color = VinylPalette.White.copy(alpha = opacity),
                        fontSize = font.sp, lineHeight = (font * 1.32f).sp, fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                        shadow = if (active) Shadow(Color(0xFFB5C7F4).copy(alpha = .48f), Offset.Zero, 18f) else null))
                    if (line.translation.isNotBlank()) BasicText(line.translation, modifier = Modifier.padding(top = 8.dp),
                        style = TextStyle(color = VinylPalette.White.copy(alpha = if (active) .72f else .38f),
                            fontSize = 16.sp, lineHeight = 24.sp, textAlign = TextAlign.Center))
                }
            }
        }
        if (browsing && state.activeLyric in state.lyrics.indices) {
            Box(Modifier.align(Alignment.BottomCenter).padding(bottom = 10.dp)
                .background(Color(0xEE24242E), RoundedCornerShape(22.dp))
                .clickable(role = Role.Button) { browsing = false; followRequest++ }
                .heightIn(min = 44.dp).padding(horizontal = 20.dp), contentAlignment = Alignment.Center) {
                BasicText("回到当前歌词", style = TextStyle(color = VinylPalette.White, fontSize = 14.sp))
            }
        }
    }
}
