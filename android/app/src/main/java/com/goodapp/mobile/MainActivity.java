package com.goodapp.mobile;

import android.Manifest;
import android.content.Intent;
import android.content.BroadcastReceiver;
import android.app.DownloadManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.pm.ActivityInfo;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.PowerManager;
import android.provider.Settings;
import android.media.AudioManager;
import android.media.AudioDeviceInfo;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import android.view.WindowManager;
import android.view.View;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import androidx.core.app.ActivityCompat;
import androidx.core.content.FileProvider;
import android.media.projection.MediaProjectionManager;
import android.app.KeyguardManager;

import java.io.File;

public class MainActivity extends BridgeActivity {
    private static final int SCREEN_SHARE_REQUEST = 9043;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 9042;
    private static final String APP_URL = "https://www.goodapp2.live";
    private static final String APK_DOWNLOAD_PATH = "/api/public/app/download";
    private long updateDownloadId = -1L;
    private String updateFileName = "Good-App-latest.apk";
    private boolean waitingForInstallPermission = false;
    private final AudioManager.OnAudioFocusChangeListener callAudioFocus = focusChange -> {};
    private PowerManager.WakeLock callWakeLock;
    private PowerManager.WakeLock mediaWakeLock;
    private boolean mediaPlaybackActive = false;
    private int orientationBeforeVideoFullscreen = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;

    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
            long completedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
            if (completedId != updateDownloadId) return;
            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            try (Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(completedId))) {
                if (cursor != null && cursor.moveToFirst()) {
                    int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                    int status = statusIndex >= 0 ? cursor.getInt(statusIndex) : DownloadManager.STATUS_FAILED;
                    if (status == DownloadManager.STATUS_SUCCESSFUL) {
                        bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('goodapp-download-status',{detail:{status:'complete'}}))",
                            null
                        ));
                        openDownloadedApk();
                        return;
                    }
                }
            } catch (Exception ignored) {}
            bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('goodapp-download-status',{detail:{status:'failed'}}))",
                null
            ));
            Toast.makeText(MainActivity.this, "আপডেট ডাউনলোড ব্যর্থ হয়েছে—আবার চেষ্টা করুন", Toast.LENGTH_LONG).show();
        }
    };

    private File updateApkFile() {
        File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        return new File(dir, updateFileName);
    }

    private void emit(String script) {
        try {
            bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript(script, null));
        } catch (Exception ignored) {}
    }

    /** Reports live download percentage into the WebView so the in-app banner can show progress. */
    private void trackProgress(final long downloadId) {
        new Thread(() -> {
            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            for (int i = 0; i < 1800; i++) {
                if (downloadId != updateDownloadId) return;
                int status = -1;
                long soFar = 0L;
                long total = 0L;
                try (Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(downloadId))) {
                    if (cursor == null || !cursor.moveToFirst()) return;
                    int si = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                    int bi = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
                    int ti = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
                    status = si >= 0 ? cursor.getInt(si) : -1;
                    soFar = bi >= 0 ? cursor.getLong(bi) : 0L;
                    total = ti >= 0 ? cursor.getLong(ti) : 0L;
                } catch (Exception ignored) {
                    return;
                }
                int percent = total > 0 ? (int) (soFar * 100 / total) : 0;
                emit("window.dispatchEvent(new CustomEvent('goodapp-download-status',{detail:{status:'progress',percent:"
                    + percent + "}}))");
                if (status == DownloadManager.STATUS_SUCCESSFUL || status == DownloadManager.STATUS_FAILED) return;
                try {
                    Thread.sleep(700);
                } catch (InterruptedException interrupted) {
                    return;
                }
            }
        }).start();
    }

    private void openDownloadedApk() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getPackageManager().canRequestPackageInstalls()) {
                waitingForInstallPermission = true;
                Intent permissionIntent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName())
                );
                startActivity(permissionIntent);
                Toast.makeText(this, "Good-App থেকে Install অনুমতি দিন, তারপর Downloads-এর APK চাপুন", Toast.LENGTH_LONG).show();
                return;
            }
            waitingForInstallPermission = false;
            File apk = updateApkFile();
            Uri apkUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apk);
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(installIntent);
        } catch (Exception error) {
            Toast.makeText(this, "ডাউনলোড শেষ—Files → Downloads থেকে Good-App APK চাপুন", Toast.LENGTH_LONG).show();
        }
    }

    private boolean openApkDownload(Uri uri) {
        if (uri == null) return false;
        String url = uri.toString().toLowerCase();
        boolean isApk = url.endsWith(".apk")
            || url.contains("application/vnd.android.package-archive")
            || APK_DOWNLOAD_PATH.equals(uri.getPath());
        if (!isApk) return false;
        try {
            Intent downloadIntent = new Intent(Intent.ACTION_VIEW, uri);
            downloadIntent.addCategory(Intent.CATEGORY_BROWSABLE);
            // Prefer Chrome; if missing, let the system choose any browser.
            try {
                downloadIntent.setPackage("com.android.chrome");
                startActivity(downloadIntent);
            } catch (Exception chromeUnavailable) {
                downloadIntent.setPackage(null);
                Intent chooserIntent = Intent.createChooser(downloadIntent, "Good-App আপডেট ডাউনলোড করুন");
                startActivity(chooserIntent);
            }
        } catch (Exception e) {
            Toast.makeText(MainActivity.this, "অ্যাপ খুলে ডাউনলোড করতে পারছে না", Toast.LENGTH_LONG).show();
            return false;
        }
        return true;
    }

    private void startNativeMediaPlayback(String title, String artist) {
        try {
            mediaPlaybackActive = true;
            PowerManager power = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (mediaWakeLock == null) {
                mediaWakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GoodApp:MediaPlayback");
            }
            if (!mediaWakeLock.isHeld()) mediaWakeLock.acquire(2 * 60 * 60 * 1000L);
            Intent service = new Intent(this, MediaPlaybackService.class);
            service.setAction(MediaPlaybackService.ACTION_START);
            service.putExtra("title", title);
            service.putExtra("artist", artist);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(service);
            else startService(service);
        } catch (Exception ignored) {}
    }

    private void playNativeMediaUrl(String url, int positionMs, String title, String artist) {
        try {
            Intent service = new Intent(this, MediaPlaybackService.class);
            service.setAction(MediaPlaybackService.ACTION_PLAY_URL);
            service.putExtra("url", url);
            service.putExtra("position_ms", Math.max(0, positionMs));
            service.putExtra("title", title);
            service.putExtra("artist", artist);
            // attachBackgroundAudio starts the foreground service while this
            // Activity is visible. Once it exists, a normal startService call
            // is allowed even after Android has moved the Activity to background.
            if (mediaPlaybackActive) startService(service);
            else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(service);
            else startService(service);
        } catch (Exception ignored) {}
    }

    private void prepareNativeMediaUrl(String url, String title, String artist) {
        try {
            mediaPlaybackActive = true;
            Intent service = new Intent(this, MediaPlaybackService.class);
            service.setAction(MediaPlaybackService.ACTION_PREPARE_URL);
            service.putExtra("url", url);
            service.putExtra("title", title);
            service.putExtra("artist", artist);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(service);
            else startService(service);
        } catch (Exception ignored) {}
    }

    private void stopNativeMediaPlayback() {
        mediaPlaybackActive = false;
        try {
            if (mediaWakeLock != null && mediaWakeLock.isHeld()) mediaWakeLock.release();
        } catch (Exception ignored) {}
        try {
            AudioManager audio = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            audio.abandonAudioFocus(callAudioFocus);
        } catch (Exception ignored) {}
        try {
            Intent service = new Intent(this, MediaPlaybackService.class);
            service.setAction(MediaPlaybackService.ACTION_STOP);
            startService(service);
        } catch (Exception ignored) {}
    }

    public final class GoodAppDownloader {
        @JavascriptInterface
        public void openExternal(String url) {
            runOnUiThread(() -> openApkDownload(Uri.parse(url)));
        }

        @JavascriptInterface
        public void beginCall(boolean video) {
            runOnUiThread(() -> {
                try {
                    PowerManager power = (PowerManager) getSystemService(Context.POWER_SERVICE);
                    if (callWakeLock == null) {
                        callWakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GoodApp:ActiveCall");
                    }
                    if (!callWakeLock.isHeld()) callWakeLock.acquire(60 * 60 * 1000L);
                } catch (Exception ignored) {}
                AudioManager audio = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                audio.requestAudioFocus(
                    callAudioFocus,
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.AUDIOFOCUS_GAIN
                );
                audio.setMode(AudioManager.MODE_IN_COMMUNICATION);
                audio.setMicrophoneMute(false);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    int preferredType = video
                        ? AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
                        : AudioDeviceInfo.TYPE_BUILTIN_EARPIECE;
                    for (AudioDeviceInfo device : audio.getAvailableCommunicationDevices()) {
                        if (device.getType() == preferredType) {
                            audio.setCommunicationDevice(device);
                            break;
                        }
                    }
                } else {
                    audio.setSpeakerphoneOn(video);
                }
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                allowOverLockScreen(Uri.parse(APP_URL + "/chat?call=active"));
            });
        }

        @JavascriptInterface
        public void endCall() {
            runOnUiThread(() -> {
                try {
                    if (callWakeLock != null && callWakeLock.isHeld()) callWakeLock.release();
                } catch (Exception ignored) {}
                AudioManager audio = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                audio.abandonAudioFocus(callAudioFocus);
                audio.setMicrophoneMute(false);
                audio.setMode(AudioManager.MODE_NORMAL);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) audio.clearCommunicationDevice();
                else audio.setSpeakerphoneOn(false);
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void beginMediaPlayback() {
            runOnUiThread(() -> startNativeMediaPlayback("Good-App audio", "Playing in background"));
        }

        @JavascriptInterface
        public void beginMediaPlaybackInfo(String title, String artist) {
            runOnUiThread(() -> startNativeMediaPlayback(title, artist));
        }

        @JavascriptInterface
        public void playMediaUrl(String url, int positionMs, String title, String artist) {
            runOnUiThread(() -> playNativeMediaUrl(url, positionMs, title, artist));
        }

        @JavascriptInterface
        public void prepareMediaUrl(String url, String title, String artist) {
            runOnUiThread(() -> prepareNativeMediaUrl(url, title, artist));
        }

        @JavascriptInterface
        public void endMediaPlayback() {
            runOnUiThread(() -> stopNativeMediaPlayback());
        }

        @JavascriptInterface
        public boolean areBubblesAllowed() {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false;
            try {
                NotificationManager manager =
                    (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                return manager != null && manager.areBubblesAllowed();
            } catch (Exception ignored) {
                return false;
            }
        }

        @JavascriptInterface
        public void openBubbleSettings() {
            runOnUiThread(() -> {
                try {
                    Intent settings = new Intent(Settings.ACTION_APP_NOTIFICATION_BUBBLE_SETTINGS);
                    settings.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                    startActivity(settings);
                } catch (Exception unavailable) {
                    Intent settings = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                    settings.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                    startActivity(settings);
                }
            });
        }

        @JavascriptInterface
        public void enterVideoFullscreen() {
            runOnUiThread(() -> {
                orientationBeforeVideoFullscreen = getRequestedOrientation();
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                );
            });
        }

        @JavascriptInterface
        public void exitVideoFullscreen() {
            runOnUiThread(() -> {
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
                setRequestedOrientation(orientationBeforeVideoFullscreen);
                orientationBeforeVideoFullscreen = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
            });
        }

        @JavascriptInterface
        public void startScreenShare() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    MediaProjectionManager manager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
                    startActivityForResult(manager.createScreenCaptureIntent(), SCREEN_SHARE_REQUEST);
                } else {
                    Toast.makeText(MainActivity.this, "Screen sharing not supported on this version", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void stopScreenShare() {
            runOnUiThread(() -> {
                stopCapture();
                bridge.getWebView().evaluateJavascript("window.dispatchEvent(new CustomEvent('goodapp-screen-share-stopped'))", null);
            });
        }

        @JavascriptInterface
        public void switchCamera() {
            runOnUiThread(() -> {
                bridge.getWebView().evaluateJavascript("window.dispatchEvent(new CustomEvent('goodapp-switch-camera'))", null);
            });
        }





        @JavascriptInterface
        public void download(String url, String fileName) {
            runOnUiThread(() -> {
                try {
                    updateFileName = fileName == null || fileName.isEmpty() ? "Good-App-latest.apk" : fileName;
                    File previous = updateApkFile();
                    if (previous.exists()) previous.delete();
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    request.setTitle("Good-App আপডেট");
                    request.setDescription("নতুন ভার্সন ডাউনলোড হচ্ছে");
                    request.setMimeType("application/vnd.android.package-archive");
                    request.setNotificationVisibility(
                        DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                    );
                    request.setAllowedOverMetered(true);
                    request.setAllowedOverRoaming(true);
                    request.setDestinationInExternalFilesDir(
                        MainActivity.this,
                        Environment.DIRECTORY_DOWNLOADS,
                        updateFileName
                    );
                    DownloadManager manager =
                        (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    updateDownloadId = manager.enqueue(request);
                    trackProgress(updateDownloadId);
                    bridge.getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('goodapp-download-status',{detail:{status:'started'}}))",
                        null
                    );
                    Toast.makeText(
                        MainActivity.this,
                        "ডাউনলোড শুরু হয়েছে — Notification দেখুন",
                        Toast.LENGTH_LONG
                    ).show();
                } catch (Exception error) {
                    bridge.getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('goodapp-download-status',{detail:{status:'fallback'}}))",
                        null
                    );
                    openApkDownload(Uri.parse(url));
                }
            });
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView appWebView = bridge.getWebView();
        // Capacitor starts server.url during super.onCreate(). Stop that first load
        // so the live page can never render before the native downloader is attached.
        appWebView.stopLoading();
        appWebView.getSettings().setDomStorageEnabled(true);
        appWebView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        appWebView.addJavascriptInterface(new GoodAppDownloader(), "GoodAppDownloader");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                new String[] { Manifest.permission.POST_NOTIFICATIONS },
                NOTIFICATION_PERMISSION_REQUEST
            );
        }
        // Never open Android settings during cold start. On some Android 14/15
        // devices ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT is unavailable or the
        // activity transition races WebView startup, which can terminate the app.
        // Incoming-call notifications continue to work without forcing this screen.
        IntentFilter downloadFilter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(downloadReceiver, downloadFilter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(downloadReceiver, downloadFilter);
        }
        // APK responses cannot be rendered by WebView. Hand any binary download
        // to Android's browser/download manager instead of silently doing nothing.
        appWebView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                Intent downloadIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                downloadIntent.addCategory(Intent.CATEGORY_BROWSABLE);
                startActivity(downloadIntent);
            } catch (Exception ignored) {
                appWebView.loadUrl(url);
            }
        });

        // Do NOT intercept every https:// link. Capacitor's BridgeWebViewClient already
        // respects allowNavigation in capacitor.config.ts, which lists the app domain,
        // Google OAuth endpoints (accounts.google.com, oauth2.googleapis.com), and Supabase.
        // Intercepting all https:// loads here broke Google OAuth: it forced the WebView to
        // reload every redirect step, which caused the account chooser to loop endlessly
        // and eventually show the "Add Gmail" screen again. We only need to handle the
        // APK download endpoint ourselves; everything else should follow Capacitor's normal
        // navigation rules so OAuth redirects and third-party cookie handling work correctly.
        appWebView.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request.isForMainFrame() && openApkDownload(request.getUrl())) return true;
                return super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && openApkDownload(Uri.parse(url))) return true;
                return super.shouldOverrideUrlLoading(view, url);
            }

            /**
             * কম RAM-এর ফোনে Android WebView-এর render process বন্ধ করে দেয়।
             * ডিফল্টে এতে পুরো অ্যাপ ক্র্যাশ করে ("Report / OK" ডায়ালগ দিয়ে ইউজারকে বের করে দেয়)।
             * এখানে আমরা সেটি ধরে ফেলে অ্যাপটি নিজে থেকেই আবার চালু করি — ইউজার বের হয়ে যাবে না।
             */
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                try {
                    if (view != null) {
                        view.loadUrl("about:blank");
                        if (view.getParent() instanceof android.view.ViewGroup) {
                            ((android.view.ViewGroup) view.getParent()).removeView(view);
                        }
                        view.destroy();
                    }
                } catch (Exception ignored) {}
                try {
                    Toast.makeText(MainActivity.this, "মেমোরি কম ছিল—Good-App আবার চালু হচ্ছে", Toast.LENGTH_SHORT).show();
                } catch (Exception ignored) {}
                try {
                    Intent restart = new Intent(MainActivity.this, MainActivity.class);
                    restart.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(restart);
                } catch (Exception ignored) {}
                finish();
                return true; // true = অ্যাপ ক্র্যাশ করবে না
            }
        });


        // If the app was opened from a deep link (e.g. an OAuth redirect), load that URL.
        // Otherwise load the canonical app URL.
        Intent launchIntent = getIntent();
        Uri launchUri = launchIntent != null ? launchIntent.getData() : null;
        if (launchUri != null && isAppDomain(launchUri)) {
            allowOverLockScreen(launchUri);
            appWebView.loadUrl(launchUri.toString());
        } else {
            appWebView.loadUrl(APP_URL);
        }
    }

    private boolean isAppDomain(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        if (!"https".equals(scheme) && !"http".equals(scheme)) return false;
        String host = uri.getHost();
        return "www.goodapp2.live".equals(host)
            || "goodapp2.live".equals(host)
            || "good-app2.lovable.app".equals(host);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        Uri uri = intent != null ? intent.getData() : null;
        if (uri != null && isAppDomain(uri) && bridge != null) {
            allowOverLockScreen(uri);
            bridge.getWebView().loadUrl(uri.toString());
        }
    }

    /**
     * An answered call must be audible while the phone is still locked. Showing the
     * activity over the keyguard (and asking the keyguard to dismiss) lets the WebView
     * resume, so getUserMedia/WebRTC audio starts immediately instead of waiting for
     * the user to unlock the phone.
     */
    private void allowOverLockScreen(Uri uri) {
        boolean isCall = uri != null && uri.getQueryParameter("call") != null;
        if (!isCall) return;
        runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true);
                setTurnScreenOn(true);
            }
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
            try {
                KeyguardManager keyguard = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
                // A *secure* keyguard (PIN/pattern/fingerprint) must NOT be dismissed here:
                // the unlock sheet pauses this activity, which suspends the WebView and
                // kills call audio until the user unlocks. Showing the call over the lock
                // screen instead keeps WebRTC running, so voice works while still locked.
                boolean secure = keyguard != null && keyguard.isKeyguardSecure();
                if (!secure && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && keyguard != null) {
                    keyguard.requestDismissKeyguard(MainActivity.this, null);
                } else {
                    getWindow().addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
                }
            } catch (Exception ignored) {}

        });
    }

    private void stopCapture() {
        try {
            ScreenShareService.setSink(null);
            Intent stop = new Intent(this, ScreenShareService.class);
            stop.setAction(ScreenShareService.ACTION_STOP);
            startService(stop);
        } catch (Exception ignored) {}
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != SCREEN_SHARE_REQUEST) return;
        if (resultCode != RESULT_OK || data == null) {
            emit("window.dispatchEvent(new CustomEvent('goodapp-screen-share-stopped'))");
            return;
        }
        // Android 14+ refuses MediaProjection unless a mediaProjection foreground
        // service owns it, which is why screen sharing used to fail silently.
        ScreenShareService.setSink(new ScreenShareService.FrameSink() {
            @Override
            public void onFrame(String base64Jpeg, int width, int height) {
                emit("window.dispatchEvent(new CustomEvent('goodapp-screen-frame',{detail:{data:'"
                    + base64Jpeg + "',width:" + width + ",height:" + height + "}}))");
            }

            @Override
            public void onStopped() {
                emit("window.dispatchEvent(new CustomEvent('goodapp-screen-share-stopped'))");
            }
        });
        Intent share = new Intent(this, ScreenShareService.class);
        share.setAction(ScreenShareService.ACTION_START);
        share.putExtra("result_code", resultCode);
        share.putExtra("result_data", data);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(share);
        else startService(share);
        emit("window.dispatchEvent(new CustomEvent('goodapp-screen-share-ready'))");
    }

    @Override
    public void onDestroy() {
        stopCapture();
        try {
            if (callWakeLock != null && callWakeLock.isHeld()) callWakeLock.release();
            if (mediaWakeLock != null && mediaWakeLock.isHeld()) mediaWakeLock.release();
        } catch (Exception ignored) {}
        // Do not stop the foreground player here. Android may recreate the
        // Activity while the app is minimized or the screen is off; playback
        // must only stop through the explicit endMediaPlayback bridge action.
        try {
            unregisterReceiver(downloadReceiver);
        } catch (Exception ignored) {}
        super.onDestroy();
    }

    @Override
    // BridgeActivity exposes these lifecycle callbacks publicly.
    public void onPause() {
        emit("window.dispatchEvent(new Event('goodapp-background'))");
        super.onPause();
    }

    @Override
    // Keep the same visibility as BridgeActivity to satisfy Java overrides.
    public void onStop() {
        super.onStop();
    }

    @Override
    public void onResume() {
        super.onResume();
        emit("window.dispatchEvent(new Event('goodapp-foreground'))");
        if (waitingForInstallPermission
            && (Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || getPackageManager().canRequestPackageInstalls())) {
            openDownloadedApk();
        }
    }
}
