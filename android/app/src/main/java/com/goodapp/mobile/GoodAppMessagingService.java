package com.goodapp.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;

import androidx.annotation.NonNull;

import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.net.HttpURLConnection;
import java.net.URL;

public class GoodAppMessagingService extends FirebaseMessagingService {
    // Notification channel settings are immutable after creation. A new ID makes
    // sure phones that received the old silent channel get the corrected ringtone.
    public static final String CALL_CHANNEL = "goodapp_incoming_calls_v3";
    // New channel ID resets phones that cached the earlier non-bubble channel state.
    public static final String MESSAGE_CHANNEL = "goodapp_messages_v5";
    public static final String SOCIAL_CHANNEL = "goodapp_social_notifications_v1";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> data = message.getData();
        if ("cancel_call".equals(data.get("type"))) {
            String callId = value(data, "call_id", "call");
            getSharedPreferences("goodapp_calls", Context.MODE_PRIVATE)
                .edit()
                .putString("cancelled_" + callId, callId)
                .apply();
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            manager.cancel(callId.hashCode());
            getSharedPreferences("goodapp_calls", Context.MODE_PRIVATE)
                .edit().remove("shown_" + callId).apply();
            Intent cancel = new Intent("com.goodapp.mobile.CANCEL_CALL");
            cancel.setPackage(getPackageName());
            cancel.putExtra("call_id", callId);
            sendBroadcast(cancel);
            return;
        }
        if ("incoming_call".equals(data.get("type"))) {
            showIncomingCall(data);
            return;
        }
        if ("chat_message".equals(data.get("type"))) {
            showChatMessage(data, message.getNotification());
            return;
        }
        if ("social_notification".equals(data.get("type"))) {
            showSocialNotification(data, message.getNotification());
            return;
        }
        PushNotificationsPlugin.sendRemoteMessage(message);
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        PushNotificationsPlugin.onNewToken(token);
    }

    private void showIncomingCall(Map<String, String> data) {
        createCallChannel();
        String callId = value(data, "call_id", "call");
        String callerId = value(data, "caller_id", "");
        String callerName = value(data, "caller_name", "Good-App user");
        boolean video = "true".equals(data.get("video"));

        // FCM can retry a high-priority data message. Never post the same call twice.
        SharedPreferences callState = getSharedPreferences("goodapp_calls", Context.MODE_PRIVATE);
        if (callId.equals(callState.getString("cancelled_" + callId, null))
            || callState.getBoolean("answered_" + callId, false)
            || callState.getBoolean("declined_" + callId, false)) return;
        String shownKey = "shown_" + callId;
        if (callState.getBoolean(shownKey, false)) return;
        callState.edit().putBoolean(shownKey, true).apply();

        Intent fullScreen = new Intent(this, IncomingCallActivity.class);
        fullScreen.putExtra("call_id", callId);
        fullScreen.putExtra("caller_id", callerId);
        fullScreen.putExtra("caller_name", callerName);
        fullScreen.putExtra("video", video);
        fullScreen.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            this,
            callId.hashCode(),
            fullScreen,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Intent declineIntent = new Intent(this, IncomingCallActivity.class);
        if (fullScreen.getExtras() != null) declineIntent.putExtras(fullScreen.getExtras());
        declineIntent.putExtra("call_action", "decline");
        declineIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent declinePending = PendingIntent.getActivity(
            this,
            callId.hashCode() + 1,
            declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Intent answerIntent = new Intent(this, IncomingCallActivity.class);
        if (fullScreen.getExtras() != null) answerIntent.putExtras(fullScreen.getExtras());
        answerIntent.putExtra("call_action", "answer");
        answerIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent answerPending = PendingIntent.getActivity(
            this,
            callId.hashCode() + 2,
            answerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Give Android enough time to post the full-screen intent while the display
        // and CPU are asleep. The lock is short and is released automatically.
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "GoodApp:IncomingCall"
        );
        wakeLock.acquire(10_000L);

        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CALL_CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(video ? "ভিডিও কল আসছে" : "কল আসছে")
            .setContentText(callerName)
            .setColor(Color.rgb(22, 163, 74))
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setSound(sound)
            .setVibrate(new long[] {0, 700, 350, 700, 350, 700})
            .setContentIntent(pending)
            .setFullScreenIntent(pending, true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "কেটে দিন", declinePending)
            .addAction(android.R.drawable.sym_action_call, "রিসিভ করুন", answerPending);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Person caller = new Person.Builder().setName(callerName).setImportant(true).build();
            builder.setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, declinePending, answerPending));
        }
        Notification notification = builder.build();
        notification.flags |= Notification.FLAG_INSISTENT;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        manager.notify(callId.hashCode(), notification);
        // Do not release immediately: notify() queues the full-screen intent asynchronously.
        // The timed lock releases itself and keeps cold-start calls reliable in deep sleep.
    }

    private void createCallChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        AudioAttributes audio = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        NotificationChannel channel = new NotificationChannel(
            CALL_CHANNEL,
            "Incoming calls",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Good-App audio and video calls");
        channel.setBypassDnd(true);
        channel.enableLights(true);
        channel.setLightColor(Color.GREEN);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] {0, 700, 350, 700, 350, 700});
        channel.setSound(sound, audio);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }

    private void showChatMessage(Map<String, String> data, RemoteMessage.Notification remoteNotification) {
        final String channelId = MESSAGE_CHANNEL;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                channelId,
                "Messages",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Good-App chat messages");
            channel.enableVibration(true);
            channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), null);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                channel.setAllowBubbles(true);
            }
            manager.createNotificationChannel(channel);
        }

        String senderId = value(data, "sender_id", "chat");
        String senderName = value(
            data,
            "sender_name",
            remoteNotification == null || remoteNotification.getTitle() == null
                ? "নতুন মেসেজ"
                : remoteNotification.getTitle()
        );
        String body = value(
            data,
            "body",
            remoteNotification == null || remoteNotification.getBody() == null
                ? "নতুন মেসেজ"
                : remoteNotification.getBody()
        );
        Bitmap senderBitmap = loadSenderBitmap(value(data, "sender_avatar_url", ""), senderName);
        IconCompat senderIcon = IconCompat.createWithAdaptiveBitmap(senderBitmap);
        Intent chat = new Intent(this, MainActivity.class);
        chat.setAction(Intent.ACTION_VIEW);
        chat.setData(Uri.parse("https://www.goodapp2.live/chat/" + Uri.encode(senderId)));
        chat.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openChat = PendingIntent.getActivity(
            this,
            senderId.hashCode(),
            chat,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Person person = new Person.Builder()
            .setName(senderName)
            .setKey(senderId)
            .setIcon(senderIcon)
            .setImportant(true)
            .build();
        NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(person)
            .setConversationTitle(senderName)
            .addMessage(body, System.currentTimeMillis(), person);

        // Inline reply straight from the notification shade.
        String replyToken = value(data, "reply_token", "");
        NotificationCompat.Action replyAction = null;
        if (!replyToken.isEmpty()) {
            int notificationId = ("chat-" + senderId).hashCode();
            androidx.core.app.RemoteInput remoteInput =
                new androidx.core.app.RemoteInput.Builder(NotificationReplyReceiver.KEY_TEXT)
                    .setLabel("উত্তর লিখুন")
                    .build();
            Intent replyIntent = new Intent(this, NotificationReplyReceiver.class);
            replyIntent.setAction(NotificationReplyReceiver.ACTION_REPLY);
            replyIntent.putExtra("sender_id", senderId);
            replyIntent.putExtra("sender_name", senderName);
            replyIntent.putExtra("reply_token", replyToken);
            replyIntent.putExtra("notification_id", notificationId);
            PendingIntent replyPending = PendingIntent.getBroadcast(
                this,
                notificationId,
                replyIntent,
                PendingIntent.FLAG_UPDATE_CURRENT
                    | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                        ? PendingIntent.FLAG_MUTABLE
                        : 0)
            );
            replyAction = new NotificationCompat.Action.Builder(
                android.R.drawable.ic_menu_send, "রিপ্লাই", replyPending)
                .addRemoteInput(remoteInput)
                .setAllowGeneratedReplies(true)
                .build();
        }
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(senderName)
            .setContentText(body)
            .setLargeIcon(senderBitmap)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setGroup("goodapp-chat-" + senderId)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(openChat)
            .setStyle(style)
            .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
            .setVibrate(new long[] {0, 180, 100, 180});
        if (replyAction != null) builder.addAction(replyAction);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // A bubble is only allowed when a matching long-lived shortcut exists
            // and the notification is tied to it via shortcutId + locusId.
            String shortcutId = "chat-" + senderId;
            IconCompat icon = senderIcon;

            Intent bubbleIntent = new Intent(this, BubbleChatActivity.class);
            bubbleIntent.setAction(Intent.ACTION_VIEW);
            bubbleIntent.setData(Uri.parse("goodapp://chat/" + Uri.encode(senderId)));
            bubbleIntent.putExtra("peer_id", senderId);
            bubbleIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_DOCUMENT | Intent.FLAG_ACTIVITY_MULTIPLE_TASK);
            PendingIntent bubblePending = PendingIntent.getActivity(
                this,
                shortcutId.hashCode(),
                bubbleIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
            );

            androidx.core.content.pm.ShortcutInfoCompat shortcut =
                new androidx.core.content.pm.ShortcutInfoCompat.Builder(this, shortcutId)
                    .setLocusId(new androidx.core.content.LocusIdCompat(shortcutId))
                    .setCategories(java.util.Collections.singleton(
                        android.content.pm.ShortcutInfo.SHORTCUT_CATEGORY_CONVERSATION
                    ))
                    .setShortLabel(senderName)
                    .setIcon(icon)
                    .setLongLived(true)
                    .setIntent(new Intent(this, MainActivity.class)
                        .setAction(Intent.ACTION_VIEW)
                        .setData(Uri.parse("https://www.goodapp2.live/chat/" + Uri.encode(senderId))))
                    .setPerson(person)
                    .setIsConversation()
                    .build();

            // Keep the dynamic-shortcut count well below the device limit so bubbles
            // never silently fail when many different senders message the user.
            pushOrUpdateConversationShortcut(shortcut);

            builder.setShortcutId(shortcutId)
                .setLocusId(new androidx.core.content.LocusIdCompat(shortcutId));

            NotificationCompat.BubbleMetadata bubble = new NotificationCompat.BubbleMetadata.Builder(
                bubblePending,
                icon
            )
                // বাবল যেন ছোট না খোলে — স্ক্রিনের প্রায় পুরো উচ্চতা চাই
                .setDesiredHeight(bubbleHeightDp())
                .setAutoExpandBubble(false)
                .setSuppressNotification(false)
                .build();
            builder.setBubbleMetadata(bubble);
        }
        manager.notify(("chat-" + senderId).hashCode(), builder.build());
    }

    /**
     * Push a conversation shortcut, but if the device is near its dynamic-shortcut
     * limit, update the existing shortcut instead and prune the oldest ones.
     * This prevents ShortcutManagerCompat.pushDynamicShortcut() from throwing
     * and silently killing the bubble metadata.
     */
    private void pushOrUpdateConversationShortcut(androidx.core.content.pm.ShortcutInfoCompat shortcut) {
        try {
            List<androidx.core.content.pm.ShortcutInfoCompat> existing =
                androidx.core.content.pm.ShortcutManagerCompat.getShortcuts(this, androidx.core.content.pm.ShortcutManagerCompat.FLAG_MATCH_DYNAMIC);
            boolean alreadyExists = false;
            for (androidx.core.content.pm.ShortcutInfoCompat s : existing) {
                if (shortcut.getId().equals(s.getId())) {
                    alreadyExists = true;
                    break;
                }
            }
            if (alreadyExists) {
                List<androidx.core.content.pm.ShortcutInfoCompat> updateList = new ArrayList<>();
                updateList.add(shortcut);
                androidx.core.content.pm.ShortcutManagerCompat.updateShortcuts(this, updateList);
            } else {
                int max = Math.max(4, androidx.core.content.pm.ShortcutManagerCompat.getMaxShortcutCountPerActivity(this) - 2);
                if (existing.size() >= max) {
                    // Remove oldest dynamic shortcuts to make room.
                    int toRemove = existing.size() - max + 1;
                    List<String> removeIds = new ArrayList<>();
                    for (int i = 0; i < toRemove && i < existing.size(); i++) {
                        removeIds.add(existing.get(i).getId());
                    }
                    if (!removeIds.isEmpty()) {
                        androidx.core.content.pm.ShortcutManagerCompat.removeLongLivedShortcuts(this, removeIds);
                    }
                }
                androidx.core.content.pm.ShortcutManagerCompat.pushDynamicShortcut(this, shortcut);
            }
        } catch (Exception e) {
            Log.w("GoodAppPush", "Failed to maintain conversation shortcut", e);
        }
    }

    /** Download the sender's signed avatar for the conversation bubble. If the
     * sender has no photo (or the network is unavailable), use their initial so
     * Android never substitutes the Good-App launcher logo as the chat identity. */
    private Bitmap loadSenderBitmap(String avatarUrl, String senderName) {
        if (avatarUrl != null && !avatarUrl.isEmpty()) {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(avatarUrl).openConnection();
                connection.setConnectTimeout(1800);
                connection.setReadTimeout(1800);
                connection.setDoInput(true);
                connection.connect();
                if (connection.getResponseCode() >= 200 && connection.getResponseCode() < 300) {
                    Bitmap bitmap = BitmapFactory.decodeStream(connection.getInputStream());
                    if (bitmap != null) return bitmap;
                }
            } catch (Exception ignored) {
                // The initial avatar below remains a stable, person-specific fallback.
            } finally {
                if (connection != null) connection.disconnect();
            }
        }

        int size = 192;
        Bitmap fallback = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(fallback);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(Color.rgb(37, 99, 235));
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
        String initial = senderName == null || senderName.trim().isEmpty()
            ? "?"
            : senderName.trim().substring(0, 1).toUpperCase();
        paint.setColor(Color.WHITE);
        paint.setTextAlign(Paint.Align.CENTER);
        paint.setTextSize(92f);
        paint.setFakeBoldText(true);
        Paint.FontMetrics metrics = paint.getFontMetrics();
        float baseline = size / 2f - (metrics.ascent + metrics.descent) / 2f;
        canvas.drawText(initial, size / 2f, baseline, paint);
        return fallback;
    }

    private void showSocialNotification(Map<String, String> data, RemoteMessage.Notification remoteNotification) {
        createSocialChannel();
        String title = value(
            data,
            "title",
            remoteNotification == null || remoteNotification.getTitle() == null
                ? "Good-App"
                : remoteNotification.getTitle()
        );
        String body = value(
            data,
            "body",
            remoteNotification == null || remoteNotification.getBody() == null
                ? "নতুন নোটিফিকেশন"
                : remoteNotification.getBody()
        );
        String url = value(data, "url", "/feed");
        Intent open = new Intent(this, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.setData(Uri.parse("https://www.goodapp2.live" + (url.startsWith("/") ? url : "/feed")));
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            this,
            ("social-" + value(data, "reference_id", title)).hashCode(),
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification notification = new NotificationCompat.Builder(this, SOCIAL_CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_SOCIAL)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM))
            .setVibrate(new long[] {0, 90, 70, 90, 70, 140})
            .build();
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        manager.notify(("social-" + value(data, "reference_id", title)).hashCode(), notification);
    }

    private void createSocialChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        AudioAttributes audio = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        NotificationChannel channel = new NotificationChannel(
            SOCIAL_CHANNEL,
            "Social notifications",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Comments, mentions, likes and friend alerts");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] {0, 90, 70, 90, 70, 140});
        channel.setSound(sound, audio);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }

    private String value(Map<String, String> data, String key, String fallback) {
        String value = data.get(key);
        return value == null || value.isEmpty() ? fallback : value;
    }
}
