package cn.toside.music.mobile;

import com.reactnativenavigation.NavigationActivity;
import com.guichaguri.trackplayer.service.MusicService;

public class MainActivity extends NavigationActivity {
    @Override
    protected void onDestroy() {
        // Swiping away the task finishes the Activity. Cut audio before React teardown.
        // Home, screen lock and configuration changes keep normal background playback.
        if (isFinishing() && !isChangingConfigurations()) {
            MusicService.stopForAppExit();
        }
        super.onDestroy();
    }
}
