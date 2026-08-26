---
title: Fix Android bubbles, background audio, and video fullscreen
---

## Goal
Make the installed Android app reliably show incoming Messenger notifications/bubbles, keep playing audio after minimize or screen-off, and play Good-App uploaded videos in true fullscreen.

## Changes
- Repair the Android chat notification pipeline so chat pushes always use the native message service, conversation shortcut, inline reply, and bubble metadata. Add a clear in-app permission/status path for Android’s per-app bubble setting instead of silently assuming bubbles are enabled.
- Harden push-token registration so the token is saved after authentication and refreshed when needed; keep dashboard unread state as a fallback when the device/user has disabled bubbles.
- Replace the fragile background handoff with a foreground media service that owns direct media playback, reports preparation/playback errors, preserves the current position, and remains active when the WebView is paused or the screen locks.
- Ensure both uploaded Good-App video URLs and resolved YouTube audio URLs are handed to the native player only after a playable URL exists, without stopping the native service during React effect refreshes.
- Add one shared fullscreen control for uploaded videos, including the dedicated watch page and reels. Use the native Android fullscreen/orientation bridge with a CSS/Web fullscreen fallback and `object-contain` so portrait and landscape media are not cropped.
- Increment the Android app version so users receive these native fixes in a newly built APK.

## Verification
- Run focused frontend checks for local video playback/fullscreen controls and media handoff lifecycle.
- Compile the Android app to catch manifest/Java/service errors.
- Verify the web build and current build-error log are clean.
- Note that real notification bubbles and screen-off playback require installing the newly generated APK; browser preview cannot validate Android OS behavior.

## Technical details
- Keep the existing `GoodAppMessagingService`, `BubbleChatActivity`, `MediaPlaybackService`, and JavaScript bridge architecture, but correct lifecycle and Android 10–16 compatibility gaps.
- Avoid changing Messenger, dashboard, feed, or player visual design beyond the required permission/status and fullscreen controls.
