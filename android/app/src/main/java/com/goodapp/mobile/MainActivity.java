package com.goodapp.mobile;

import android.content.Intent;
import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.app.DownloadManager;
import android.content.Context;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import androidx.core.content.FileProvider;

import java.io.File;

public class MainActivity extends BridgeActivity {
    private static final String APP_URL = "https://www.goodapp2.live";
    private static final String APK_DOWNLOAD_PATH = "/api/public/app/download";
    private long updateDownloadId = -1L;
    private String updateFileName = "Good-App-latest.apk";

    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
            long completedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
            if (completedId != updateDownloadId) return;
            openDownloadedApk();
        }
    };

    private void openDownloadedApk() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getPackageManager().canRequestPackageInstalls()) {
                Intent permissionIntent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName())
                );
                startActivity(permissionIntent);
                Toast.makeText(this, "Good-App থেকে Install অনুমতি দিন, তারপর Downloads-এর APK চাপুন", Toast.LENGTH_LONG).show();
                return;
            }
            File apk = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), updateFileName);
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
        if (uri == null || !APK_DOWNLOAD_PATH.equals(uri.getPath())) return false;
        try {
            Intent downloadIntent = new Intent(Intent.ACTION_VIEW, uri);
            downloadIntent.addCategory(Intent.CATEGORY_BROWSABLE);
            // The app owns goodapp2.live deep links, so explicitly use Chrome
            // when available to prevent the download URL reopening this app.
            downloadIntent.setPackage("com.android.chrome");
            startActivity(downloadIntent);
        } catch (Exception chromeUnavailable) {
            Intent chooserIntent = new Intent(Intent.ACTION_VIEW, uri);
            chooserIntent.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(Intent.createChooser(chooserIntent, "Good-App আপডেট ডাউনলোড করুন"));
        }
        return true;
    }

    private class GoodAppDownloader {
        @JavascriptInterface
        public void download(String url, String fileName) {
            runOnUiThread(() -> {
                try {
                    updateFileName = fileName == null || fileName.isEmpty() ? "Good-App-latest.apk" : fileName;
                    File previous = new File(
                        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                        updateFileName
                    );
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
                    request.setDestinationInExternalPublicDir(
                        Environment.DIRECTORY_DOWNLOADS,
                        updateFileName
                    );
                    DownloadManager manager =
                        (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    updateDownloadId = manager.enqueue(request);
                    Toast.makeText(
                        MainActivity.this,
                        "ডাউনলোড শুরু হয়েছে — Notification দেখুন",
                        Toast.LENGTH_LONG
                    ).show();
                } catch (Exception error) {
                    openApkDownload(Uri.parse(url));
                }
            });
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView appWebView = bridge.getWebView();
        appWebView.getSettings().setDomStorageEnabled(true);
        appWebView.addJavascriptInterface(new GoodAppDownloader(), "GoodAppDownloader");
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
        appWebView.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request.isForMainFrame() && openApkDownload(request.getUrl())) return true;
                String scheme = request.getUrl().getScheme();
                // Main-frame web navigation must stay in the native app. This also
                // catches redirects before Capacitor can hand them to Chrome.
                if (request.isForMainFrame() && ("https".equals(scheme) || "http".equals(scheme))) {
                    view.loadUrl(request.getUrl().toString());
                    return true;
                }
                return super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && openApkDownload(Uri.parse(url))) return true;
                if (url != null && (url.startsWith("https://") || url.startsWith("http://"))) {
                    view.loadUrl(url);
                    return true;
                }
                return super.shouldOverrideUrlLoading(view, url);
            }
        });

        // Explicitly start the website only after our WebView client is attached.
        // Previously Capacitor could begin loading first and an early redirect could
        // reach Android before the custom client existed, opening Chrome.
        appWebView.loadUrl(APP_URL);
    }

    @Override
    protected void onDestroy() {
        try {
            unregisterReceiver(downloadReceiver);
        } catch (Exception ignored) {}
        super.onDestroy();
    }
}
