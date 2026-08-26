package com.goodapp.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * Messenger-style floating chat bubble window. Android only allows an activity to
 * be shown inside a bubble when it is embeddable, resizeable and launched as a
 * separate document — MainActivity (singleTask) can never satisfy that, so the
 * bubble needs its own lightweight activity.
 */
public class BubbleChatActivity extends BridgeActivity {
    private static final String BASE_URL = "https://www.goodapp2.live";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        openChat(getIntent() == null ? null : getIntent().getStringExtra("peer_id"));
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        openChat(intent == null ? null : intent.getStringExtra("peer_id"));
    }

    private void openChat(String peerId) {
        if (peerId == null || peerId.isEmpty()) return;
        final String url = BASE_URL + "/chat/" + android.net.Uri.encode(peerId);
        try {
            getBridge().getWebView().post(() -> {
                try {
                    getBridge().getWebView().loadUrl(url);
                } catch (Exception ignored) {}
            });
        } catch (Exception ignored) {}
    }
}
