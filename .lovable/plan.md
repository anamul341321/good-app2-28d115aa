# Premium Communication Overhaul

## 1. High-Performance WebRTC & Audio Infrastructure
- **Low-Latency Audio**: Optimize constraints in `CallProvider.tsx` (48kHz, mono, aggressive echo/noise suppression).
- **ICE Resilience**: 
  - Switch to a robust TURN infrastructure (using `openrelay.metered.ca` with more entry points).
  - Implement `ICE Restart` logic that triggers automatically on `disconnected` or `failed` states.
  - Add a connection quality indicator (UI showing "Connecting...", "Poor Connection", etc.).
- **Synchronized State**: Ensure both peers stay in sync regarding mute/camera status through dedicated realtime signals.
- **Resource Cleanup**: Hardened `cleanup()` to ensure audio context, tracks, and native bridges are fully reset.

## 2. Native Android Full-Screen Calling (Lock Screen)
- **Activity Flags**: Update `IncomingCallActivity.java` with `FLAG_DISMISS_KEYGUARD` and `FLAG_SHOW_WHEN_LOCKED` correctly for Android 12+.
- **FCM Hardening**:
  - Use `NotificationCompat.CallStyle` for a native look.
  - Implement a dedicated `NotificationChannel` with `IMPORTANCE_HIGH` and persistent ringing.
  - Add `answer` and `decline` actions that trigger the app without manual unlock (via `PendingIntent` flags).
- **Wake Lock**: Use `PowerManager.WakeLock` in `GoodAppMessagingService` to ensure the CPU wakes up even in deep sleep.
- **Deep Linking**: Refine `/chat/$peerId?call=$callId&accept=1` routing to instantly attach to the session.

## 3. Premium Video Call Quality
- **Adaptive Bitrate**: Configure WebRTC encodings to maintain framerate and adjust bitrate based on network (up to 1.5Mbps for clear video).
- **UI Overhaul**: 
  - Blurred avatar background for audio calls.
  - Floating pill-style control bar (translucent glass effect).
  - Front/Back camera switching bridge.
- **Hardware Acceleration**: Enable native hardware codecs via WebView settings in `MainActivity.java`.

## 4. One-Click Screen Sharing
- **Native Implementation**: 
  - Add `startScreenShare` and `stopScreenShare` to `GoodAppDownloader` bridge in `MainActivity.java`.
  - Use `MediaProjection` API for native capture.
- **Web Interface**:
  - Add a "Share Screen" button to the call UI.
  - Replace the video track in the `RTCPeerConnection` seamlessly.
- **Security**: Official permission dialog is mandatory (Android requirement).

## 5. Security & Reliability
- **Permissions**: Add a clear, localized "Camera/Mic Permission" request flow before the call starts.
- **Duplicate Prevention**: Implement `callId` idempotency in both the database and native shared preferences.

## Technical Tasks
- **Migration**: Add `call_sessions.audio_settings` jsonb if needed for future tuning.
- **Android**: Update `IncomingCallActivity.java`, `GoodAppMessagingService.java`, `MainActivity.java`, and `AndroidManifest.xml`.
- **Frontend**: Overhaul `CallProvider.tsx` and related UI components.
