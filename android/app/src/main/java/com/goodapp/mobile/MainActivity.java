package com.goodapp.mobile;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    private static final String APP_URL = "https://www.goodapp2.live";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView appWebView = bridge.getWebView();
        appWebView.getSettings().setDomStorageEnabled(true);
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
}
