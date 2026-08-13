package com.goodapp.mobile;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class IncomingCallActivity extends Activity {
    private Ringtone ringtone;
    private String callId;
    private String callerId;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        callId = getIntent().getStringExtra("call_id");
        callerId = getIntent().getStringExtra("caller_id");
        String callerName = getIntent().getStringExtra("caller_name");
        boolean video = getIntent().getBooleanExtra("video", false);
        if (callerName == null || callerName.isEmpty()) callerName = "Good-App user";

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(48, 80, 48, 64);
        root.setBackgroundColor(Color.rgb(7, 15, 33));

        TextView kind = text(video ? "ভিডিও কল আসছে" : "অডিও কল আসছে", 16, Color.rgb(103, 232, 249));
        TextView avatar = text(callerName.substring(0, 1).toUpperCase(), 52, Color.WHITE);
        avatar.setGravity(Gravity.CENTER);
        avatar.setBackgroundColor(Color.rgb(37, 99, 235));
        LinearLayout.LayoutParams avatarParams = new LinearLayout.LayoutParams(220, 220);
        avatarParams.setMargins(0, 70, 0, 42);
        TextView name = text(callerName, 30, Color.WHITE);
        name.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        TextView subtitle = text("Good-App কল", 15, Color.LTGRAY);

        LinearLayout actions = new LinearLayout(this);
        actions.setGravity(Gravity.CENTER);
        actions.setPadding(0, 110, 0, 0);
        Button decline = button("কেটে দিন", Color.rgb(225, 29, 72));
        Button accept = button("রিসিভ করুন", Color.rgb(22, 163, 74));
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(0, 150, 1);
        buttonParams.setMargins(14, 0, 14, 0);
        actions.addView(decline, buttonParams);
        actions.addView(accept, buttonParams);

        root.addView(kind);
        root.addView(avatar, avatarParams);
        root.addView(name);
        root.addView(subtitle);
        root.addView(actions, new LinearLayout.LayoutParams(-1, -2));
        setContentView(root);

        decline.setOnClickListener(v -> closeCall());
        accept.setOnClickListener(v -> openCall());
        startRinging();
    }

    private TextView text(String value, int size, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER);
        return view;
    }

    private Button button(String value, int color) {
        Button button = new Button(this);
        button.setText(value);
        button.setTextSize(16);
        button.setTextColor(Color.WHITE);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setBackgroundColor(color);
        return button;
    }

    private void startRinging() {
        try {
            ringtone = RingtoneManager.getRingtone(this, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) ringtone.setLooping(true);
            ringtone.play();
        } catch (Exception ignored) {}
    }

    private void openCall() {
        stopRinging();
        String url = "https://www.goodapp2.live/chat/" + Uri.encode(callerId == null ? "" : callerId)
            + "?call=" + Uri.encode(callId == null ? "" : callId);
        Intent app = new Intent(this, MainActivity.class);
        app.setAction(Intent.ACTION_VIEW);
        app.setData(Uri.parse(url));
        app.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(app);
        finish();
    }

    private void closeCall() {
        stopRinging();
        finish();
    }

    private void stopRinging() {
        try {
            if (ringtone != null && ringtone.isPlaying()) ringtone.stop();
        } catch (Exception ignored) {}
        if (callId != null) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            manager.cancel(callId.hashCode());
        }
    }

    @Override
    protected void onDestroy() {
        stopRinging();
        super.onDestroy();
    }
}