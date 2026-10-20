package cn.toside.music.mobile.vinyl

import org.junit.Assert.*
import org.junit.Test

class LockScreenPolicyTest {
    @Test fun showsOnlyDuringAnAuthorizedPlayingLockedScreenSession() {
        assertTrue(shouldShowLockScreen(true, true, true, true, true, true, false))
        // Independently check switch, track, playback, keyguard, display,
        // permission and dismissal for the current lock cycle.
        for (gate in 0..6) {
            val flags = MutableList(7) { true }.apply { this[6] = false; this[gate] = !this[gate] }
            assertFalse("Gate $gate must prevent presentation", shouldShowLockScreen(
                flags[0], flags[1], flags[2], flags[3], flags[4], flags[5], flags[6]))
        }
    }
}
