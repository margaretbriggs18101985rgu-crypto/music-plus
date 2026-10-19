package cn.toside.music.mobile.vinyl

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.outlined.Info
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.painterResource
import cn.toside.music.mobile.R

/** The app's existing IcoMoon icon set, shared with React Native. */
internal val PlayerIconFont = FontFamily(Font(R.font.vinyl_icons))
internal enum class PlayerIcon(val code: Int) {
    Menu(59680), Search(59660), Heart(59657), Comment(59672),
    Play(59653), Pause(59661), Previous(59668), Next(59654), Back(59664),
    Repeat(59649), Shuffle(59650), Order(59651), RepeatOne(59652), Single(59673), Info(0), Download(59656), More(59667), Lock(0)
}

@Composable
internal fun PlayerIconButton(
    icon: PlayerIcon,
    label: String,
    size: Int = 24,
    enabled: Boolean = true,
    color: Color = VinylPalette.White,
    modifier: Modifier = Modifier,
    selected: Boolean = false,
    onClick: () -> Unit,
) {
    Box(
        modifier.size(48.dp)
            .semantics { contentDescription = label }
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (icon == PlayerIcon.Info) Image(imageVector = Icons.Outlined.Info, contentDescription = null,
            modifier = Modifier.size(size.dp), colorFilter = ColorFilter.tint(if (enabled) color else color.copy(alpha = .3f)))
        else if (icon == PlayerIcon.Lock) Image(
            imageVector = Icons.Filled.Lock,
            contentDescription = null, modifier = Modifier.size(size.dp),
            colorFilter = ColorFilter.tint(if (enabled) color else color.copy(alpha = .3f)),
        ) else if (icon == PlayerIcon.Heart) Image(
            imageVector = if (selected) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
            contentDescription = null, modifier = Modifier.size(size.dp),
            colorFilter = ColorFilter.tint(if (enabled) color else color.copy(alpha = .3f)),
        ) else if (icon == PlayerIcon.Previous || icon == PlayerIcon.Next) Image(
            painter = painterResource(if (icon == PlayerIcon.Previous) R.drawable.vinyl_skip_previous else R.drawable.vinyl_skip_next),
            contentDescription = null, modifier = Modifier.size(size.dp),
            colorFilter = ColorFilter.tint(if (enabled) color else color.copy(alpha = .3f)),
        ) else BasicText(
            String(Character.toChars(icon.code)),
            modifier = Modifier.clearAndSetSemantics { },
            style = TextStyle(fontFamily = PlayerIconFont, fontSize = size.sp,
                color = if (enabled) color else color.copy(alpha = .3f)),
        )
    }
}
