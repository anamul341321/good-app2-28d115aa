package com.goodapp2.live;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.graphics.YuvImage;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.view.WindowManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

/**
 * Android 10+ (and mandatorily Android 14+) requires a foreground service with the
 * mediaProjection type before MediaProjection can be used. Without this service the
 * screen-share permission dialog appeared but capture silently failed. The service
 * captures the screen and streams compressed JPEG frames to the WebView, which turns
 * them into a canvas MediaStream track for WebRTC.
 */
public class ScreenShareService extends Service {
    public static final String ACTION_START = "com.goodapp.mobile.START_SHARE";
    public static final String ACTION_STOP = "com.goodapp.mobile.STOP_SHARE";
    private static final String CHANNEL = "goodapp_screen_share";

    public interface FrameSink {
        void onFrame(String base64Jpeg, int width, int height);
        void onStopped();
    }

    private static FrameSink sink;

    public static void setSink(@Nullable FrameSink value) {
        sink = value;
    }

    private MediaProjection projection;
    private VirtualDisplay virtualDisplay;
    private ImageReader reader;
    private HandlerThread thread;
    private Handler handler;
    private long lastFrameAt = 0L;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        if (ACTION_STOP.equals(intent.getAction())) {
            teardown();
            stopSelf();
            return START_NOT_STICKY;
        }

        startForegroundNotification();

        int resultCode = intent.getIntExtra("result_code", 0);
        Intent resultData = intent.getParcelableExtra("result_data");
        if (resultData == null) {
            teardown();
            stopSelf();
            return START_NOT_STICKY;
        }

        try {
            MediaProjectionManager manager =
                (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            projection = manager.getMediaProjection(resultCode, resultData);
            if (projection == null) throw new IllegalStateException("no projection");
            thread = new HandlerThread("goodapp-screen-share");
            thread.start();
            handler = new Handler(thread.getLooper());
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                projection.registerCallback(new MediaProjection.Callback() {
                    @Override
                    public void onStop() {
                        notifyStopped();
                    }
                }, handler);
            }
            startCapture();
        } catch (Exception error) {
            teardown();
            stopSelf();
            notifyStopped();
        }
        return START_NOT_STICKY;
    }

    private void startForegroundNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL, "Screen sharing", NotificationManager.IMPORTANCE_LOW);
            manager.createNotificationChannel(channel);
        }
        Notification notification = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_goodapp)
            .setContentTitle("স্ক্রিন শেয়ার চালু")
            .setContentText("Good-App কলে স্ক্রিন শেয়ার হচ্ছে")
            .setOngoing(true)
            .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                7311,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
            );
        } else {
            startForeground(7311, notification);
        }
    }

    private void startCapture() {
        DisplayMetrics metrics = new DisplayMetrics();
        WindowManager windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        windowManager.getDefaultDisplay().getMetrics(metrics);

        // Keep it clear but still light enough for the WebView bridge.
        float scale = Math.min(1f, 960f / Math.max(metrics.widthPixels, metrics.heightPixels));
        final int width = Math.max(160, (int) (metrics.widthPixels * scale) / 2 * 2);
        final int height = Math.max(160, (int) (metrics.heightPixels * scale) / 2 * 2);

        reader = ImageReader.newInstance(width, height, android.graphics.PixelFormat.RGBA_8888, 2);
        virtualDisplay = projection.createVirtualDisplay(
            "goodapp-share",
            width,
            height,
            metrics.densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            reader.getSurface(),
            null,
            handler
        );
        reader.setOnImageAvailableListener(r -> {
            Image image = null;
            try {
                image = r.acquireLatestImage();
                if (image == null) return;
                long now = System.currentTimeMillis();
                if (now - lastFrameAt < 55L) return; // ~18 fps
                lastFrameAt = now;
                emitFrame(image, width, height);
            } catch (Exception ignored) {
            } finally {
                if (image != null) image.close();
            }
        }, handler);
    }

    private void emitFrame(Image image, int width, int height) {
        Image.Plane plane = image.getPlanes()[0];
        ByteBuffer buffer = plane.getBuffer();
        int rowStride = plane.getRowStride();
        int pixelStride = plane.getPixelStride();
        int rowPadding = rowStride - pixelStride * width;
        Bitmap bitmap = Bitmap.createBitmap(width + rowPadding / pixelStride, height, Bitmap.Config.ARGB_8888);
        bitmap.copyPixelsFromBuffer(buffer);
        Bitmap cropped = Bitmap.createBitmap(bitmap, 0, 0, width, height);
        bitmap.recycle();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        cropped.compress(Bitmap.CompressFormat.JPEG, 68, out);
        cropped.recycle();
        String base64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        FrameSink current = sink;
        if (current != null) current.onFrame(base64, width, height);
    }

    private void notifyStopped() {
        FrameSink current = sink;
        if (current != null) current.onStopped();
    }

    private void teardown() {
        try {
            if (reader != null) reader.setOnImageAvailableListener(null, null);
            if (virtualDisplay != null) virtualDisplay.release();
            if (reader != null) reader.close();
            if (projection != null) projection.stop();
            if (thread != null) thread.quitSafely();
        } catch (Exception ignored) {}
        virtualDisplay = null;
        reader = null;
        projection = null;
        thread = null;
    }

    @Override
    public void onDestroy() {
        teardown();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
