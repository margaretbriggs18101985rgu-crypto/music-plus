package cn.toside.music.mobile.vinyl

import kotlin.math.abs

internal data class LyricPerspective(
    val dragPx: Float = 0f,
    val translationPx: Float = 0f,
    val yaw: Float = 0f,
    val backgroundPx: Float = 0f,
    val midgroundPx: Float = 0f,
    val foregroundPx: Float = 0f,
)

/** All inputs/outputs use pixels except yaw (degrees). No playback state is changed here. */
internal fun lyricPerspective(dragPx: Float, widthPx: Float, density: Float): LyricPerspective {
    if (!dragPx.isFinite() || !widthPx.isFinite() || widthPx <= 0f ||
        !density.isFinite() || density <= 0f) return LyricPerspective()
    val drag = dragPx.coerceIn(-widthPx * .28f, widthPx * .28f)
    val normalized = (drag / (widthPx * .25f).coerceAtLeast(.001f)).coerceIn(-1f, 1f)
    return LyricPerspective(drag, (drag * .85f).coerceIn(-48f * density, 48f * density),
        normalized * 9f, drag * .15f, drag * .30f, drag * .45f)
}

internal enum class LyricDragAxis { Pending, Horizontal, Vertical }

/** Locks once per touch; a diagonal with equal displacement belongs to vertical scrolling. */
internal class LyricDragSession {
    var axis = LyricDragAxis.Pending
        private set
    var dragPx = 0f
        private set

    fun move(x: Float, y: Float, slop: Float) {
        if (!x.isFinite() || !y.isFinite() || !slop.isFinite() || slop < 0f) { reset(); return }
        if (axis == LyricDragAxis.Pending && maxOf(abs(x), abs(y)) > slop) {
            axis = if (abs(x) > abs(y)) LyricDragAxis.Horizontal else LyricDragAxis.Vertical
        }
        if (axis == LyricDragAxis.Horizontal) dragPx = x
    }

    // Both release and cancel discard the input state; the view alone owns the return spring.
    fun reset() { axis = LyricDragAxis.Pending; dragPx = 0f }
}
