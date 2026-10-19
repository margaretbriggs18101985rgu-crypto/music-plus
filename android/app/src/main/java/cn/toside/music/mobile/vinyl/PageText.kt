package cn.toside.music.mobile.vinyl

import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow

private data class PageAppearance(val font: FontFamily = FontFamily.SansSerif, val color: Color? = null)
private val LocalPageAppearance = staticCompositionLocalOf { PageAppearance() }

@Composable
internal fun PageTypographyScope(state: VinylPlayerState, content: @Composable () -> Unit) {
    val color = state.pageFontColor.takeIf { it.matches(Regex("#[0-9A-Fa-f]{6}")) }
        ?.let { Color(android.graphics.Color.parseColor(it)) }
    CompositionLocalProvider(LocalPageAppearance provides PageAppearance(lyricFontFamily(state.pageFontFamily), color), content = content)
}

/** Only UI labels use this wrapper. Lyric renderers retain their own explicit font/color. */
@Composable
internal fun PageText(text: String, modifier: Modifier = Modifier, style: TextStyle = TextStyle.Default,
    maxLines: Int = Int.MAX_VALUE, overflow: TextOverflow = TextOverflow.Clip) {
    val appearance = LocalPageAppearance.current
    val color = appearance.color?.let {
        when (style.color) {
            VinylPalette.White -> it
            VinylPalette.Muted -> it.copy(alpha = .64f)
            else -> style.color
        }
    } ?: style.color
    BasicText(text, modifier = modifier, style = style.copy(fontFamily = appearance.font, color = color), maxLines = maxLines, overflow = overflow)
}
