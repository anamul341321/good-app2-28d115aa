package com.anamul.goodapp;

import android.app.Application;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

/**
 * শেষ নিরাপত্তা-জাল: কোনো unexpected Java exception হলে Android ডিফল্টভাবে
 * "Good-App keeps stopping / Report — OK" ডায়ালগ দেখিয়ে ইউজারকে বের করে দেয়।
 * এখানে আমরা সেটি ধরে ফেলে অ্যাপটি নিজেই আবার চালু করি, তাই ইউজার অ্যাপ থেকে
 * বের হয়ে যায় না।
 */
public class GoodAppApplication extends Application {

    @Override
    public void onCreate() {
        super.onCreate();

        final Thread.UncaughtExceptionHandler previous =
            Thread.getDefaultUncaughtExceptionHandler();

        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try {
                new Handler(Looper.getMainLooper()).post(() -> {
                    try {
                        Toast.makeText(
                            GoodAppApplication.this,
                            "Good-App আবার চালু হচ্ছে…",
                            Toast.LENGTH_SHORT
                        ).show();
                    } catch (Throwable ignored) {}
                });

                Intent restart = new Intent(this, MainActivity.class);
                restart.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_CLEAR_TASK
                );
                android.app.PendingIntent pending = android.app.PendingIntent.getActivity(
                    this,
                    9711,
                    restart,
                    android.app.PendingIntent.FLAG_ONE_SHOT | android.app.PendingIntent.FLAG_IMMUTABLE
                );
                android.app.AlarmManager alarm =
                    (android.app.AlarmManager) getSystemService(ALARM_SERVICE);
                if (alarm != null) {
                    alarm.set(
                        android.app.AlarmManager.RTC,
                        System.currentTimeMillis() + 400,
                        pending
                    );
                }
            } catch (Throwable ignored) {
                if (previous != null) previous.uncaughtException(thread, error);
            } finally {
                // প্রক্রিয়াটি বন্ধ করে দিই — উপরের alarm অ্যাপটি আবার খুলে দেবে,
                // ফলে সিস্টেমের ক্র্যাশ ডায়ালগ ইউজার দেখতে পায় না।
                android.os.Process.killProcess(android.os.Process.myPid());
                System.exit(10);
            }
        });
    }

    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        if (level >= TRIM_MEMORY_RUNNING_LOW) {
            try {
                System.gc();
            } catch (Throwable ignored) {}
        }
    }
}
