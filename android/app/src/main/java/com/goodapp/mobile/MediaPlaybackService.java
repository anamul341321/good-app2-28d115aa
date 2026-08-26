package com.goodapp.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;

public class MediaPlaybackService extends Service {
    public static final String ACTION_START = "com.goodapp.mobile.MEDIA_START";
    public static final String ACTION_STOP = "com.goodapp.mobile.MEDIA_STOP";
    public static final String ACTION_PLAY_URL = "com.goodapp.mobile.MEDIA_PLAY_URL";
    public static final String ACTION_PREPARE_URL = "com.goodapp.mobile.MEDIA_PREPARE_URL";
    public static final String ACTION_TOGGLE = "com.goodapp.mobile.MEDIA_TOGGLE";
    private static final String CHANNEL = "goodapp_media_playback_v2";
    private static final int NOTIFICATION_ID = 7312;

    private ExoPlayer player;
    private String preparedUrl;
    private long requestedPositionMs;
    private boolean playWhenReady;
    private String currentTitle = "Good-App অডিও";
    private String currentArtist = "ব্যাকগ্রাউন্ডে চলছে";

    @Override
    public void onCreate() {
        super.onCreate();
        createPlayer();
    }

    private void createPlayer() {
        if (player != null) return;
        player = new ExoPlayer.Builder(this).build();
        player.setAudioAttributes(
            new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build(),
            true
        );
        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_READY && playWhenReady) {
                    if (requestedPositionMs > 0) player.seekTo(requestedPositionMs);
                    requestedPositionMs = 0;
                    player.play();
                } else if (state == Player.STATE_ENDED) {
                    stopPlayback();
                }
                updateNotification();
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                updateNotification();
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                preparedUrl = null;
                playWhenReady = false;
                updateNotification();
            }
        });
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopPlayback();
            return START_NOT_STICKY;
        }

        updateMetadata(intent);
        startForegroundNotification();
        createPlayer();

        if (intent != null && ACTION_TOGGLE.equals(intent.getAction())) {
            if (player != null) {
                if (player.isPlaying()) player.pause();
                else player.play();
            }
        } else if (intent != null && ACTION_PREPARE_URL.equals(intent.getAction())) {
            prepareUrl(intent.getStringExtra("url"), false, 0);
        } else if (intent != null && ACTION_PLAY_URL.equals(intent.getAction())) {
            prepareUrl(
                intent.getStringExtra("url"),
                true,
                Math.max(0, intent.getIntExtra("position_ms", 0))
            );
        }
        return START_STICKY;
    }

    private void updateMetadata(Intent intent) {
        if (intent == null) return;
        String title = intent.getStringExtra("title");
        String artist = intent.getStringExtra("artist");
        if (title != null && !title.trim().isEmpty()) currentTitle = title;
        if (artist != null && !artist.trim().isEmpty()) currentArtist = artist;
    }

    private void prepareUrl(String url, boolean shouldPlay, long positionMs) {
        if (url == null || url.trim().isEmpty() || player == null) return;
        requestedPositionMs = positionMs;
        playWhenReady = shouldPlay;
        if (url.equals(preparedUrl) && player.getPlaybackState() != Player.STATE_IDLE) {
            if (shouldPlay) {
                if (positionMs > 0) player.seekTo(positionMs);
                player.play();
            }
            return;
        }
        preparedUrl = url;
        player.setMediaItem(MediaItem.fromUri(url));
        player.prepare();
    }

    private void stopPlayback() {
        if (player != null) {
            player.stop();
            player.clearMediaItems();
        }
        preparedUrl = null;
        requestedPositionMs = 0;
        playWhenReady = false;
        stopForeground(true);
        stopSelf();
    }

    private void updateNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification());
    }

    private void startForegroundNotification() {
        createChannel();
        Notification notification = buildNotification();
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

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL,
            "ব্যাকগ্রাউন্ড অডিও",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Good-App গান ও ভিডিওর অডিও");
        channel.setSound(null, null);
        manager.createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent open = PendingIntent.getActivity(
            this, NOTIFICATION_ID, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent toggleIntent = new Intent(this, MediaPlaybackService.class).setAction(ACTION_TOGGLE);
        PendingIntent toggle = PendingIntent.getService(
            this, NOTIFICATION_ID + 1, toggleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Intent stopIntent = new Intent(this, MediaPlaybackService.class).setAction(ACTION_STOP);
        PendingIntent stop = PendingIntent.getService(
            this, NOTIFICATION_ID + 2, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        boolean isPlaying = player != null && player.isPlaying();
        return new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setContentIntent(open)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(isPlaying || playWhenReady)
            .setOnlyAlertOnce(true)
            .addAction(
                isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                isPlaying ? "বিরতি" : "চালান",
                toggle
            )
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "বন্ধ", stop)
            .build();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Foreground playback deliberately outlives the WebView task.
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }
}
