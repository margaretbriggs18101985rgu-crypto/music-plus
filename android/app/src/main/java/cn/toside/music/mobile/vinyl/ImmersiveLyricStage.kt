package cn.toside.music.mobile.vinyl

import android.util.Log
import cn.toside.music.mobile.BuildConfig

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
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.platform.LocalDensity
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

@Stable
internal class LyricStageDrag {
    var rotation by mutableStateOf(LyricRotation())
    var dragging by mutableStateOf(false)
}

@Composable
internal fun ImmersiveLyricStage(state: VinylPlayerState, drag: LyricStageDrag, motionEnabled: Boolean,
    modifier: Modifier, audio: State<AudioMotion>, phase: State<Double>) {
    val density = LocalDensity.current.density
    val scope = rememberCoroutineScope()
    var inertia by remember { mutableStateOf<Job?>(null) }
    DisposableEffect(state.trackId, motionEnabled) {
        onDispose { inertia?.cancel(); drag.rotation = LyricRotation(); drag.dragging = false }
    }
    Box(modifier.fillMaxWidth().clipToBounds().pointerInput(state.trackId, motionEnabled) {
        if (!motionEnabled) return@pointerInput
        var lastTapAt = 0L
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
            inertia?.cancel()
            val velocity = VelocityTracker()
            velocity.addPosition(down.uptimeMillis, down.position)
            var previous = down.position
            var released = false
            var upAt = down.uptimeMillis
            try {
                while (true) {
                    val event = awaitPointerEvent(PointerEventPass.Initial)
                    val change = event.changes.firstOrNull { it.id == down.id } ?: break
                    if (event.changes.count { it.pressed } > 1 || change.isConsumed) break
                    if (!change.pressed) {
                        if (drag.dragging) change.consume()
                        released = true
                        upAt = change.uptimeMillis
                        break
                    }
                    velocity.addPosition(change.uptimeMillis, change.position)
                    if (!drag.dragging && (change.position - down.position).getDistance() > viewConfiguration.touchSlop) {
                        drag.dragging = true
                        previous = down.position
                    }
                    if (drag.dragging) {
                        change.consume()
                        val delta = (change.position - previous) / density
                        drag.rotation = rotateLyric(drag.rotation, delta.x, delta.y)
                        previous = change.position
                    }
                }
            } finally {
                val wasDragging = drag.dragging
                drag.dragging = false
                if (released && wasDragging) {
                    lastTapAt = 0L
                    val speed = velocity.calculateVelocity()
                    inertia = scope.launch {
                        var spin = lyricReleaseSpin(drag.rotation, speed.x / density, speed.y / density)
                        var previousTime = withFrameNanos { it }
                        while (spin.pitchSpeed != 0f || spin.yawSpeed != 0f) withFrameNanos { now ->
                            spin = advanceLyricSpin(spin, (now - previousTime) / 1_000_000_000f)
                            previousTime = now
                            drag.rotation = spin.rotation
                        }
                        if (BuildConfig.DEBUG) Log.d("LyricRotation", "settled pitch=${drag.rotation.pitch} yaw=${drag.rotation.yaw}")
                    }
                } else if (released) {
                    // mineradio's blank-stage double tap recenters the camera.
                    if (upAt - lastTapAt in 1..350) { drag.rotation = LyricRotation(); lastTapAt = 0L }
                    else lastTapAt = upAt
                }
            }
        }
    }) {
        PlayerLyrics(state, Modifier.fillMaxSize().graphicsLayer {
            rotationY = drag.rotation.yaw
            rotationX = drag.rotation.pitch
            cameraDistance = maxOf(500f * density, size.width * 1.2f)
        }, motionEnabled, audio, phase)
    }
}
