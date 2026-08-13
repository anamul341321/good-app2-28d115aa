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

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;

import androidx.annotation.NonNull;

import java.util.Map;

public class GoodAppMessagingService extends FirebaseMessagingService {
    public static final String CALL_CHANNEL = "goodapp_incoming_calls_v1";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> data = message.getData();
        if ("cancel_call".equals(data.get("type"))) {
            String callId = value(data, "call_id", "call");
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            manager.cancel(callId.hashCode());
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

        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        Notification notification = new NotificationCompat.Builder(this, CALL_CHANNEL)
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
            .build();
        notification.flags |= Notification.FLAG_INSISTENT;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        manager.notify(callId.hashCode(), notification);
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
