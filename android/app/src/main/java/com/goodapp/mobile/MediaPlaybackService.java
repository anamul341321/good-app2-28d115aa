package com.goodapp.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.PowerManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class MediaPlaybackService extends Service {
    public static final String ACTION_START = "com.goodapp.mobile.MEDIA_START";
    public static final String ACTION_STOP = "com.goodapp.mobile.MEDIA_STOP";
    public static final String ACTION_PLAY_URL = "com.goodapp.mobile.MEDIA_PLAY_URL";
    public static final String ACTION_PREPARE_URL = "com.goodapp.mobile.MEDIA_PREPARE_URL";
    private static final String CHANNEL = "goodapp_media_playback";
    private static final int NOTIFICATION_ID = 7312;
    private MediaPlayer player;
    private AudioManager audioManager;
    private String preparedUrl;
    private boolean prepared;
    private boolean playWhenPrepared;
    private int requestedPositionMs;
    private final AudioManager.OnAudioFocusChangeListener audioFocusListener = focusChange -> {
        if (player == null) return;
        if (focusChange == AudioManager.AUDIOFOCUS_LOSS) {
            releasePlayer();
            stopForeground(true);
            stopSelf();
        } else if (focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT
            || focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
            try { player.pause(); } catch (Exception ignored) {}
        } else if (focusChange == AudioManager.AUDIOFOCUS_GAIN) {
            try { player.start(); } catch (Exception ignored) {}
        }
    };

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            releasePlayer();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        String title = intent == null ? null : intent.getStringExtra("title");
        String artist = intent == null ? null : intent.getStringExtra("artist");
        startForegroundNotification(
            title == null || title.trim().isEmpty() ? "Good-App audio" : title,
            artist == null || artist.trim().isEmpty() ? "Playing in background" : artist
        );
        if (intent != null && ACTION_PREPARE_URL.equals(intent.getAction())) {
            prepareUrl(intent.getStringExtra("url"));
        } else if (intent != null && ACTION_PLAY_URL.equals(intent.getAction())) {
            playPreparedUrl(
                intent.getStringExtra("url"),
                Math.max(0, intent.getIntExtra("position_ms", 0))
            );
        }
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // The player lives in this foreground service, not the WebView task. Keep
        // it alive when the user minimizes or swipes the app away.
        if (player == null) stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    private void prepareUrl(String url) {
        if (url == null || url.trim().isEmpty()) return;
        if (url.equals(preparedUrl) && player != null) return;
        releasePlayer();
        try {
            audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
            audioManager.requestAudioFocus(
                audioFocusListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            );
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build());
            player.setWakeMode(getApplicationContext(), PowerManager.PARTIAL_WAKE_LOCK);
            player.setDataSource(url);
            preparedUrl = url;
            prepared = false;
            playWhenPrepared = false;
            requestedPositionMs = 0;
            player.setOnPreparedListener(mediaPlayer -> {
                prepared = true;
                if (playWhenPrepared) startPreparedPlayer();
            });
            player.setOnCompletionListener(mediaPlayer -> stopSelf());
            player.setOnErrorListener((mediaPlayer, what, extra) -> {
                stopSelf();
                return true;
            });
            player.prepareAsync();
        } catch (Exception ignored) {
            releasePlayer();
        }
    }

    private void playPreparedUrl(String url, int positionMs) {
        if (url == null || url.trim().isEmpty()) return;
        requestedPositionMs = positionMs;
        playWhenPrepared = true;
        if (!url.equals(preparedUrl) || player == null) {
            prepareUrl(url);
            playWhenPrepared = true;
            requestedPositionMs = positionMs;
            return;
        }
        if (prepared) startPreparedPlayer();
    }

    private void startPreparedPlayer() {
        if (player == null || !prepared) return;
        try {
            if (requestedPositionMs > 0) player.seekTo(requestedPositionMs);
            player.start();
        } catch (Exception ignored) {
            releasePlayer();
        }
    }

    private void releasePlayer() {
        if (player != null) {
            try { player.stop(); } catch (Exception ignored) {}
            try { player.release(); } catch (Exception ignored) {}
            player = null;
        }
        preparedUrl = null;
        prepared = false;
        playWhenPrepared = false;
        requestedPositionMs = 0;
        if (audioManager != null) {
            try { audioManager.abandonAudioFocus(audioFocusListener); } catch (Exception ignored) {}
            audioManager = null;
        }
    }

    private void startForegroundNotification(String title, String artist) {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) {
            stopSelf();
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL,
                "Media playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Good-App background audio playback");
            manager.createNotificationChannel(channel);
        }

        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            NOTIFICATION_ID,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(artist)
            .setContentIntent(pendingIntent)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        releasePlayer();
        super.onDestroy();
    }
}