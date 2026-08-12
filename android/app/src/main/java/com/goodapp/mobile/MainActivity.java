package com.goodapp.mobile;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep every Good-App page inside the native WebView. This is a native
        // fallback in addition to Capacitor's allowNavigation configuration,
        // so redirects between our canonical and legacy domains cannot launch Chrome.
        bridge.getWebView().setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                boolean isGoodAppHost = host != null && (
                    host.equals("www.goodapp2.live") ||
                    host.equals("goodapp2.live") ||
                    host.equals("good-app2.lovable.app")
                );

                if (isGoodAppHost && ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) {
                    view.loadUrl(uri.toString());
                    return true;
                }

                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }
}
