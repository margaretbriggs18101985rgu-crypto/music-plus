package cn.toside.music.mobile.vinyl

import android.content.Context
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import cn.toside.music.mobile.R
import com.facebook.react.views.text.ReactFontManager

internal fun normalizeLyricFont(value: String): String =
    if (value in setOf("wenkai", "xiaowei", "huangyou")) value else "system"

private val WenKai by lazy { FontFamily(Font(R.font.lyric_wenkai)) }
private val XiaoWei by lazy { FontFamily(Font(R.font.lyric_xiaowei)) }
private val HuangYou by lazy { FontFamily(Font(R.font.lyric_huangyou)) }

internal fun lyricFontFamily(value: String): FontFamily = when (value) {
    "wenkai" -> WenKai
    "xiaowei" -> XiaoWei
    "huangyou" -> HuangYou
    else -> FontFamily.SansSerif
}

private var previewsRegistered = false

/** RN setting cards and Compose lyrics use the exact same bundled font files. */
@Synchronized
internal fun registerLyricPreviewFonts(context: Context) {
    if (previewsRegistered) return
    ReactFontManager.getInstance().apply {
        addCustomFont(context, "LyricWenKai", R.font.lyric_wenkai)
        addCustomFont(context, "LyricXiaoWei", R.font.lyric_xiaowei)
        addCustomFont(context, "LyricHuangYou", R.font.lyric_huangyou)
    }
    previewsRegistered = true
}
