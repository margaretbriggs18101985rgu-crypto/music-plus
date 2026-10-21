package cn.toside.music.mobile.vinyl

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class VinylPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(
        VinylNavigationModule(context), MusicDownloadModule(context), LockScreenModule(context), HomeWidgetModule(context))
    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = listOf(VinylPlayerViewManager(), WallpaperViewManager())
}
