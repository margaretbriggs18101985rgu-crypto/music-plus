package cn.toside.music.mobile.vinyl

/** Defaults and bounds mirror reactiveVisuals.ts; only validated values reach the renderer. */
data class ReactiveVisuals(
    val intensity: Float = .85f, val depth: Float = .2f, val coverResolution: Int = 512,
    val cinema: Float = .5f, val cinemaEnabled: Boolean = true,
    val particleGlow: Boolean = false, val outlineHighlight: Boolean = false, val starRiver: Boolean = true,
    val particleSize: Float = 1f, val speed: Float = 1f, val twist: Float = 0f,
    val colorTension: Float = 1.1f, val bloom: Float = .62f, val scatter: Float = 0f, val backgroundDim: Float = .2f,
    val terrainEnabled: Boolean = false, val terrainHeight: Float = .55f, val terrainDepth: Float = .6f, val terrainOffset: Float = .78f,
    val spectrumEnabled: Boolean = false, val kickAuto: Boolean = true, val kickSensitivity: Float = 1f,
    val kickLowHz: Float = 45f, val kickHighHz: Float = 170f,
    val bassWeight: Float = 1f, val midWeight: Float = .65f, val trebleWeight: Float = .45f,
)
