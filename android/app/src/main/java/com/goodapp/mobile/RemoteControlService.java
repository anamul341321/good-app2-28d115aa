package com.goodapp.mobile;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.os.Build;
import android.util.DisplayMetrics;
import android.view.accessibility.AccessibilityEvent;

/**
 * রিমোট কন্ট্রোল — স্ক্রিন শেয়ার চলার সময় অন্য পাশ থেকে আসা ট্যাপ/স্বাইপ
 * এই সার্ভিস আসল টাচ হিসেবে ফোনে চালায়। ইউজার নিজে Settings থেকে অনুমতি
 * না দিলে এটি কখনো চালু হয় না, আর কল শেষ হলে অ্যাপ কমান্ড পাঠানো বন্ধ করে।
 */
public class RemoteControlService extends AccessibilityService {
    private static RemoteControlService instance;

    public static boolean isConnected() {
        return instance != null;
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
    }

    @Override
    public boolean onUnbind(android.content.Intent intent) {
        instance = null;
        return super.onUnbind(intent);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // আমরা কোনো স্ক্রিন কনটেন্ট পড়ি না — শুধু জেসচার চালাই।
    }

    @Override
    public void onInterrupt() {}

    /** নরমালাইজড (0..1) কো-অর্ডিনেটে ট্যাপ */
    public static boolean tap(float nx, float ny) {
        RemoteControlService svc = instance;
        if (svc == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false;
        DisplayMetrics dm = svc.getResources().getDisplayMetrics();
        float x = Math.max(1f, Math.min(dm.widthPixels - 1f, nx * dm.widthPixels));
        float y = Math.max(1f, Math.min(dm.heightPixels - 1f, ny * dm.heightPixels));
        Path path = new Path();
        path.moveTo(x, y);
        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(new GestureDescription.StrokeDescription(path, 0, 60));
        return svc.dispatchGesture(builder.build(), null, null);
    }

    /** নরমালাইজড কো-অর্ডিনেটে স্বাইপ (স্ক্রল) */
    public static boolean swipe(float nx1, float ny1, float nx2, float ny2, long durationMs) {
        RemoteControlService svc = instance;
        if (svc == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false;
        DisplayMetrics dm = svc.getResources().getDisplayMetrics();
        Path path = new Path();
        path.moveTo(nx1 * dm.widthPixels, ny1 * dm.heightPixels);
        path.lineTo(nx2 * dm.widthPixels, ny2 * dm.heightPixels);
        long dur = Math.max(80L, Math.min(2000L, durationMs));
        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(new GestureDescription.StrokeDescription(path, 0, dur));
        return svc.dispatchGesture(builder.build(), null, null);
    }

    /** ব্যাক / হোম বাটন */
    public static boolean globalAction(String action) {
        RemoteControlService svc = instance;
        if (svc == null) return false;
        if ("back".equals(action)) return svc.performGlobalAction(GLOBAL_ACTION_BACK);
        if ("home".equals(action)) return svc.performGlobalAction(GLOBAL_ACTION_HOME);
        if ("recents".equals(action)) return svc.performGlobalAction(GLOBAL_ACTION_RECENTS);
        return false;
    }
}
