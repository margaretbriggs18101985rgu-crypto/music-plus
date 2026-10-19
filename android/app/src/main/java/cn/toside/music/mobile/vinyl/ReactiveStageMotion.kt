package cn.toside.music.mobile.vinyl

internal fun weightedAudioEnergy(audio: AudioMotion, fx: ReactiveVisuals): Float =
    ((audio.bass * fx.bassWeight + audio.mid * fx.midWeight + audio.treble * fx.trebleWeight) / 2.1f).coerceIn(0f, 1f)

internal data class StageCamera(val scale: Float = 1f, val pitch: Float = 0f, val yaw: Float = 0f)

/** Continuous frequency balance gives a slow orbit; only detected onsets give the lens a push. */
internal fun stageCamera(audio: AudioMotion, fx: ReactiveVisuals, enabled: Boolean): StageCamera {
    if (!enabled || !fx.cinemaEnabled || fx.intensity <= 0f || fx.cinema <= 0f) return StageCamera()
    val amount = fx.intensity * fx.cinema
    val beat = audio.beat * fx.bassWeight
    val pitch = (audio.orbitPitch * weightedAudioEnergy(audio, fx) * 2f - beat * 1.6f - audio.bass * fx.bassWeight * .35f) * amount
    return StageCamera(1f + (beat * .018f + weightedAudioEnergy(audio, fx) * .006f) * amount,
        if (pitch == 0f) 0f else pitch,
        (audio.orbitYaw * weightedAudioEnergy(audio, fx) * 3.8f + audio.mid * fx.midWeight - audio.treble * fx.trebleWeight) * amount * 1.3f)
}
