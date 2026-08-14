package com.goodapp.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;

import androidx.annotation.NonNull;

import java.util.Map;

public class GoodAppMessagingService extends FirebaseMessagingService {
    // Notification channel settings are immutable after creation. A new ID makes
    // sure phones that received the old silent channel get the corrected ringtone.
    public static final String CALL_CHANNEL = "goodapp_incoming_calls_v3";

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
        String shownKey = "shown_" + callId;
        if (getSharedPreferences("goodapp_calls", Context.MODE_PRIVATE).getBoolean(shownKey, false)) return;
        getSharedPreferences("goodapp_calls", Context.MODE_PRIVATE)
            .edit().putBoolean(shownKey, true).apply();

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

    private String value(Map<String, String> data, String key, String fallback) {
        String value = data.get(key);
        return value == null || value.isEmpty() ? fallback : value;
    }
}
