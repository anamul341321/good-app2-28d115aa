package com.anamul.goodapp;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Toast;

import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Handles the inline "Reply" action on chat notifications. The push payload carries a
 * short-lived signed token so the reply can be delivered without opening the app.
 */
public class NotificationReplyReceiver extends BroadcastReceiver {
    public static final String ACTION_REPLY = "com.anamul.goodapp.CHAT_REPLY";
    public static final String KEY_TEXT = "goodapp_reply_text";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_REPLY.equals(intent.getAction())) return;
        Bundle results = RemoteInput.getResultsFromIntent(intent);
        CharSequence reply = results == null ? null : results.getCharSequence(KEY_TEXT);
        final String body = reply == null ? "" : reply.toString().trim();
        final String senderId = intent.getStringExtra("sender_id");
        final String senderName = intent.getStringExtra("sender_name");
        final String token = intent.getStringExtra("reply_token");
        final int notificationId = intent.getIntExtra("notification_id", 0);
        if (body.isEmpty() || senderId == null || token == null) return;

        new Thread(() -> {
            boolean ok = false;
            try {
                URL url = new URL("https://www.goodapp2.live/api/public/chat/reply");
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setDoOutput(true);
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(20000);
                connection.setRequestProperty("Content-Type", "application/json");
                JSONObject payload = new JSONObject();
                payload.put("token", token);
                payload.put("peerId", senderId);
                payload.put("body", body);
                try (OutputStream out = connection.getOutputStream()) {
                    out.write(payload.toString().getBytes("UTF-8"));
                }
                ok = connection.getResponseCode() < 300;
                connection.disconnect();
            } catch (Exception ignored) {}

            NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (ok) {
                // Show the sent reply inside the same conversation notification.
                androidx.core.app.Person me =
                    new androidx.core.app.Person.Builder().setName("আপনি").build();
                androidx.core.app.Person them =
                    new androidx.core.app.Person.Builder()
                        .setName(senderName == null ? "মেসেজ" : senderName)
                        .build();
                NotificationCompat.MessagingStyle style =
                    new NotificationCompat.MessagingStyle(me)
                        .setConversationTitle(senderName == null ? "মেসেজ" : senderName)
                        .addMessage(body, System.currentTimeMillis(), me);
                NotificationCompat.Builder builder =
                    new NotificationCompat.Builder(context, GoodAppMessagingService.MESSAGE_CHANNEL)
                        .setSmallIcon(R.drawable.ic_stat_goodapp)
                        .setContentTitle(senderName == null ? "মেসেজ" : senderName)
                        .setContentText(body)
                        .setStyle(style)
                        .setOnlyAlertOnce(true)
                        .setAutoCancel(true);
                manager.notify(notificationId, builder.build());
            } else {
                manager.cancel(notificationId);
            }
        }).start();
    }
}
