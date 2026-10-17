package cn.toside.music.mobile.vinyl

import android.content.Context
import android.content.Intent
import cn.toside.music.mobile.MainActivity
import cn.toside.music.mobile.MainApplication
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.atomic.AtomicReference

/** Lets the Debug visual harness open real, existing application destinations. */
object VinylNavigation {
    private val pendingRoute = AtomicReference<String?>(null)
    fun takeRoute(): String? = pendingRoute.getAndSet(null)

    fun open(context: Context, route: String) {
        if (route !in setOf("home", "nav_search", "nav_love", "nav_setting")) return
        pendingRoute.set(route)
        val host = (context.applicationContext as MainApplication).reactNativeHost
        if (host.hasInstance()) host.reactInstanceManager.currentReactContext
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("LXVinylNavigate", null)
        context.startActivity(Intent(context, MainActivity::class.java).addFlags(
            Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP))
    }
}

class VinylNavigationModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "LXVinylNavigation"
    @ReactMethod fun consumeRoute(promise: Promise) { promise.resolve(VinylNavigation.takeRoute()) }
}
