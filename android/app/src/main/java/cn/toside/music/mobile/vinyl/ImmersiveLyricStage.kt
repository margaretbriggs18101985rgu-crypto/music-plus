package cn.toside.music.mobile.vinyl

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

@Stable
internal class LyricStageDrag {
    val offset = mutableFloatStateOf(0f)
    var dragging by mutableStateOf(false)
}

@Composable
internal fun ImmersiveLyricStage(
    state: VinylPlayerState,
    drag: LyricStageDrag,
    motionEnabled: Boolean,
    modifier: Modifier,
    onAction: PlayerAction,
) {
    val density = LocalDensity.current.density
    val scope = rememberCoroutineScope()
    var returning by remember { mutableStateOf<Job?>(null) }
    DisposableEffect(state.trackId, motionEnabled) {
        onDispose { returning?.cancel(); drag.offset.floatValue = 0f; drag.dragging = false }
    }
    Box(modifier.fillMaxWidth().clipToBounds().pointerInput(state.trackId, motionEnabled) {
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
            returning?.cancel()
            val startOffset = drag.offset.floatValue
            val session = LyricDragSession()
            try {
                while (true) {
                    val event = awaitPointerEvent(PointerEventPass.Initial)
                    val change = event.changes.firstOrNull { it.id == down.id } ?: break
                    if (event.changes.count { it.pressed } > 1 || change.isConsumed) break
                    if (!change.pressed) {
                        if (session.axis == LyricDragAxis.Horizontal) change.consume()
                        break
                    }
                    session.move(change.position.x - down.position.x, change.position.y - down.position.y, viewConfiguration.touchSlop)
                    if (session.axis == LyricDragAxis.Vertical) break // never consume a vertical move
                    if (session.axis == LyricDragAxis.Horizontal) {
                        change.consume() // Initial pass cancels the child click before its Main pass.
                        drag.dragging = true
                        drag.offset.floatValue = if (motionEnabled)
                            lyricPerspective(startOffset + session.dragPx, size.width.toFloat(), density).dragPx else 0f
                    }
                }
            } finally {
                session.reset()
                drag.dragging = false
                val released = drag.offset.floatValue
                returning = if (!motionEnabled) null else scope.launch {
                    val springOffset = Animatable(released)
                    springOffset.animateTo(0f, spring(dampingRatio = .82f, stiffness = 400f, visibilityThreshold = .2f)) {
                        drag.offset.floatValue = value
                    }
                    drag.offset.floatValue = 0f
                }
            }
        }
    }) {
        PlayerLyrics(state, Modifier.fillMaxSize().graphicsLayer {
            val perspective = lyricPerspective(drag.offset.floatValue, size.width, density)
            translationX = perspective.translationPx
            rotationY = perspective.yaw
            cameraDistance = maxOf(500f * density, size.width * 1.2f)
        }, onAction, motionEnabled, drag.dragging)
    }
}
