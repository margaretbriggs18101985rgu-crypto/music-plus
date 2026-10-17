package cn.toside.music.mobile.vinyl

import android.app.Activity
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.provider.DocumentsContract
import com.facebook.react.bridge.*
import org.json.JSONObject
import java.util.concurrent.Executors
import java.io.File
import android.graphics.BitmapFactory

/** Persists each transfer destination; only user-selected SAF trees receive files. */
internal object MusicDownloads {
    val worker = Executors.newSingleThreadExecutor()
    private fun store(context: Context) = context.getSharedPreferences("musicplus_download_destinations", Context.MODE_PRIVATE)
    fun remember(context: Context, id: Long, tree: String, filename: String) {
        store(context).edit().putString(id.toString(), JSONObject().put("tree", tree).put("filename", filename).toString()).apply()
    }
    fun owns(context: Context, id: Long) = store(context).contains(id.toString())
    @Synchronized fun export(context: Context, id: Long): Uri? {
        val prefs = store(context)
        val raw = prefs.getString(id.toString(), null) ?: return null
        val record = JSONObject(raw)
        if (record.has("uri")) return Uri.parse(record.getString("uri"))
        val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val source = manager.getUriForDownloadedFile(id) ?: return null
        val tree = Uri.parse(record.getString("tree"))
        val parent = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
        val mime = manager.getMimeTypeForDownloadedFile(id) ?: "audio/mpeg"
        val destination = DocumentsContract.createDocument(context.contentResolver, parent, mime, record.getString("filename"))
            ?: throw IllegalStateException("无法在所选文件夹创建文件")
        try {
            context.contentResolver.openInputStream(source).use { input ->
                requireNotNull(input) { "下载文件不可读取" }
                context.contentResolver.openOutputStream(destination, "w").use { output ->
                    requireNotNull(output) { "所选文件夹不可写入" }
                    input.copyTo(output)
                }
            }
            record.put("uri", destination.toString())
            prefs.edit().putString(id.toString(), record.toString()).apply()
            // The verified exported copy now owns the file; remove only this app's temporary transfer.
            manager.remove(id)
            return destination
        } catch (e: Exception) {
            DocumentsContract.deleteDocument(context.contentResolver, destination)
            throw e
        }
    }
    fun exported(context: Context, id: Long): Uri? = store(context).getString(id.toString(), null)?.let {
        JSONObject(it).optString("uri").takeIf(String::isNotBlank)?.let(Uri::parse)
    }
    fun forget(context: Context, id: Long) { store(context).edit().remove(id.toString()).apply() }
}

class MusicDownloadReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
        val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
        if (!MusicDownloads.owns(context, id)) return
        val pending = goAsync()
        MusicDownloads.worker.execute { try { MusicDownloads.export(context, id) } catch (_: Exception) { /* UI query reports a recoverable export failure. */ } finally { pending.finish() } }
    }
}

class MusicDownloadModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "LXMusicDownload"
    private val manager get() = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    private var folderPromise: Promise? = null
    private val folderRequest = 7813
    private var coverPromise: Promise? = null
    private val coverRequest = 7814
    init {
        context.addActivityEventListener(object : BaseActivityEventListener() {
            override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
                if (requestCode == coverRequest) {
                    val promise = coverPromise ?: return
                    coverPromise = null
                    val uri = data?.data
                    if (resultCode != Activity.RESULT_OK || uri == null) { promise.resolve(null); return }
                    MusicDownloads.worker.execute {
                        var file: File? = null
                        try {
                            val folder = File(context.filesDir, "playlist-covers").apply { mkdirs() }
                            val destination = File(folder, "${System.currentTimeMillis()}.img")
                            file = destination
                            context.contentResolver.openInputStream(uri).use { input ->
                                requireNotNull(input) { "图片不可读取" }
                                destination.outputStream().use { output ->
                                    val buffer = ByteArray(8192)
                                    var total = 0L
                                    while (true) {
                                        val count = input.read(buffer)
                                        if (count < 0) break
                                        total += count
                                        require(total <= 25 * 1024 * 1024) { "请选择小于 25 MB 的图片" }
                                        output.write(buffer, 0, count)
                                    }
                                }
                            }
                            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                            BitmapFactory.decodeFile(destination.absolutePath, bounds)
                            require(bounds.outWidth > 0 && bounds.outHeight > 0) { "请选择有效的图片" }
                            promise.resolve(Uri.fromFile(destination).toString())
                        } catch (e: Exception) { file?.delete(); promise.reject("COVER_READ", e.message, e) }
                    }
                    return
                }
                if (requestCode != folderRequest) return
                val promise = folderPromise ?: return
                folderPromise = null
                val uri = data?.data
                if (resultCode != Activity.RESULT_OK || uri == null) { promise.resolve(null); return }
                try {
                    context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                    val parent = DocumentsContract.buildDocumentUriUsingTree(uri, DocumentsContract.getTreeDocumentId(uri))
                    var name = DocumentsContract.getTreeDocumentId(uri)
                    context.contentResolver.query(parent, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use { cursor -> if (cursor.moveToFirst()) name = cursor.getString(0) }
                    promise.resolve(Arguments.createMap().apply { putString("uri", uri.toString()); putString("name", name) })
                } catch (e: Exception) { promise.reject("FOLDER_ACCESS", e.message, e) }
            }
        })
    }
    @ReactMethod fun chooseCover(promise: Promise) {
        val activity = currentActivity ?: run { promise.reject("NO_ACTIVITY", "请在应用前台选择图片"); return }
        if (coverPromise != null) { promise.reject("COVER_BUSY", "图片选择器已打开"); return }
        coverPromise = promise
        try {
            activity.startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*")
                .addCategory(Intent.CATEGORY_OPENABLE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION), coverRequest)
        } catch (e: Exception) { coverPromise = null; promise.reject("COVER_OPEN", e.message, e) }
    }
    @ReactMethod fun chooseFolder(promise: Promise) {
        val activity = currentActivity ?: run { promise.reject("NO_ACTIVITY", "请在应用前台选择文件夹"); return }
        if (folderPromise != null) { promise.reject("FOLDER_BUSY", "文件夹选择器已打开"); return }
        folderPromise = promise
        try {
            activity.startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION), folderRequest)
        } catch (e: Exception) { folderPromise = null; promise.reject("FOLDER_OPEN", e.message, e) }
    }
    @ReactMethod fun start(url: String, filename: String, title: String, tree: String, promise: Promise) {
        try {
            val uri = Uri.parse(url)
            require(uri.scheme in setOf("https", "http")) { "音源没有返回可下载的 HTTP 文件" }
            require(DocumentsContract.isTreeUri(Uri.parse(tree))) { "请先选择保存文件夹" }
            val clean = filename.replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), "_").take(180)
            require(clean.isNotBlank() && clean != "." && clean != "..") { "文件名无效" }
            val request = DownloadManager.Request(uri).setTitle(title).setDescription("MusicPlus 音乐下载")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .addRequestHeader("User-Agent", "Mozilla/5.0")
                .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, "${System.currentTimeMillis()}_$clean")
            val id = manager.enqueue(request)
            MusicDownloads.remember(context, id, tree, clean)
            promise.resolve(id.toDouble())
        } catch (e: Exception) { promise.reject("DOWNLOAD_START", e.message, e) }
    }
    @ReactMethod fun query(id: Double, promise: Promise) {
        MusicDownloads.worker.execute {
            try {
                fun completed(uri: Uri): WritableMap {
                    context.contentResolver.openAssetFileDescriptor(uri, "r").use { requireNotNull(it) { "下载文件已移走或无法读取" } }
                    return Arguments.createMap().apply { putInt("status", 8); putInt("reason", 0); putDouble("bytes", 0.0); putDouble("total", 0.0); putString("uri", uri.toString()) }
                }
                val exported = MusicDownloads.exported(context, id.toLong())
                if (exported != null) { promise.resolve(completed(exported)); return@execute }
                manager.query(DownloadManager.Query().setFilterById(id.toLong())).use { cursor ->
                    if (!cursor.moveToFirst()) { promise.reject("DOWNLOAD_MISSING", "下载任务不存在"); return@execute }
                    val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                    if (status == DownloadManager.STATUS_SUCCESSFUL) {
                        val destination = MusicDownloads.export(context, id.toLong()) ?: throw IllegalStateException("保存到所选文件夹失败")
                        promise.resolve(completed(destination)); return@execute
                    }
                    promise.resolve(Arguments.createMap().apply {
                        putInt("status", status)
                        putInt("reason", cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)))
                        putDouble("bytes", cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)).toDouble())
                        putDouble("total", cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)).toDouble())
                    })
                }
            } catch (e: Exception) { promise.reject("DOWNLOAD_QUERY", "文件不可访问，请检查保存位置与权限：${e.message}", e) }
        }
    }
    @ReactMethod fun cancel(id: Double, promise: Promise) {
        try { manager.remove(id.toLong()); MusicDownloads.forget(context, id.toLong()); promise.resolve(null) } catch (e: Exception) { promise.reject("DOWNLOAD_CANCEL", e.message, e) }
    }
    @ReactMethod fun open(id: Double, promise: Promise) {
        try {
            val uri = MusicDownloads.exported(context, id.toLong()) ?: throw IllegalStateException("下载尚未保存完成")
            val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, context.contentResolver.getType(uri) ?: "audio/*")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            context.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) { promise.reject("DOWNLOAD_OPEN", e.message, e) }
    }
}
