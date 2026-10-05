import { readFileSync, writeFileSync } from "node:fs";

const manifestPath = "android/app/src/main/AndroidManifest.xml";
let manifest = readFileSync(manifestPath, "utf8");

const removePermission = (name: string) => {
  manifest = manifest.replace(
    new RegExp(`\\s*<uses-permission android:name="${name.replaceAll(".", "\\.")}" \\/>`, "g"),
    "",
  );
};

const removeNamedNode = (tag: "activity" | "service" | "receiver", name: string) => {
  const marker = `android:name="${name}"`;
  let markerAt = manifest.indexOf(marker);
  while (markerAt >= 0) {
    const start = manifest.lastIndexOf(`<${tag}`, markerAt);
    const openingEnd = manifest.indexOf(">", markerAt);
    const pairedClose = manifest.indexOf(`</${tag}>`, markerAt);
    if (start < 0 || openingEnd < 0) break;
    const usesSelfClose = manifest.slice(start, openingEnd + 1).trimEnd().endsWith("/>");
    if (!usesSelfClose && pairedClose < 0) break;
    const end = usesSelfClose ? openingEnd + 1 : pairedClose + tag.length + 3;
    manifest = `${manifest.slice(0, start)}${manifest.slice(end)}`;
    markerAt = manifest.indexOf(marker);
  }
};

[
  "com.google.android.gms.permission.AD_ID",
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.USE_FULL_SCREEN_INTENT",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
].forEach(removePermission);

removeNamedNode("activity", ".BubbleChatActivity");
removeNamedNode("activity", ".IncomingCallActivity");
removeNamedNode("service", ".MediaPlaybackService");
removeNamedNode("service", ".ScreenShareService");
removeNamedNode("receiver", ".NotificationReplyReceiver");

manifest = manifest.replace(
  /\s*<!-- AdMob App ID[\s\S]*?<meta-data\s+android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID"[\s\S]*?\/>/g,
  "",
);

writeFileSync(manifestPath, manifest);
console.log("Store Android manifest sanitized: ads, calls, microphone, screen sharing, and external-app surfaces removed.");