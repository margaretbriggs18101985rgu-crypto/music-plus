package cn.toside.music.mobile.vinyl

/** Keep eligibility separate from Android so lock/unlock and dismissal can be verified. */
internal fun shouldShowLockScreen(enabled: Boolean, hasTrack: Boolean, playing: Boolean,
    locked: Boolean, interactive: Boolean, overlayAllowed: Boolean, dismissed: Boolean): Boolean =
    enabled && hasTrack && playing && locked && interactive && overlayAllowed && !dismissed
