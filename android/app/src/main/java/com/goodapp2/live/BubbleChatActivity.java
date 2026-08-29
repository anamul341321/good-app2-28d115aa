package com.goodapp2.live;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;

/**
 * Messenger-style floating chat bubble window. Android only allows an activity to
 * be shown inside a bubble when it is embeddable, resizeable and launched as a
 * separate document — MainActivity (singleTask) can never satisfy that, so the
 * bubble needs its own lightweight activity.
 */
public class BubbleChatActivity extends BridgeActivity {
    private static final String BASE_URL = "https://www.goodapp2.live";
    private String currentPeerId = null;

    /** JS bridge: বাবল থেকে ফুল স্ক্রিন মেসেঞ্জারে যাওয়ার জন্য। */
    public class GoodAppBubble {
        @JavascriptInterface
        public void openFullscreen(String peerId) {
            final String target = peerId == null || peerId.isEmpty() ? currentPeerId : peerId;
            runOnUiThread(() -> {
                try {
                    String url = target == null || target.isEmpty()
                        ? BASE_URL + "/chat"
                        : BASE_URL + "/chat/" + Uri.encode(target);
                    Intent open = new Intent(BubbleChatActivity.this, MainActivity.class);
                    open.setAction(Intent.ACTION_VIEW);
                    open.setData(Uri.parse(url));
                    open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    startActivity(open);
                    finish();
                } catch (Exception ignored) {}
            });
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            getBridge().getWebView().addJavascriptInterface(new GoodAppBubble(), "GoodAppBubble");
        } catch (Exception ignored) {}
        openChat(getIntent() == null ? null : getIntent().getStringExtra("peer_id"));
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        openChat(intent == null ? null : intent.getStringExtra("peer_id"));
    }

    private void openChat(String peerId) {
        currentPeerId = peerId;
        final String url = peerId == null || peerId.isEmpty()
            ? BASE_URL + "/chat?bubble=1"
            : BASE_URL + "/chat/" + android.net.Uri.encode(peerId) + "?bubble=1";
        try {
            getBridge().getWebView().post(() -> {
                try {
                    getBridge().getWebView().loadUrl(url);
                } catch (Exception ignored) {}
            });
        } catch (Exception ignored) {}
    }
}
