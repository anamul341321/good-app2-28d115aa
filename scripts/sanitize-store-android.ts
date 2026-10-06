import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const manifestPath = "android/app/src/main/AndroidManifest.xml";
const mainActivityPath = "android/app/src/main/java/com/anamul/goodapp/MainActivity.java";
const unityPluginPath = "android/app/src/main/java/com/anamul/goodapp/UnityAdsPlugin.java";
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
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.WAKE_LOCK",
  "android.permission.SYSTEM_ALERT_WINDOW",
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

// The store manifest drops the AdMob APPLICATION_ID meta-data, so the AdMob SDK
// must leave the store binary too — otherwise it crashes on launch ("app
// installs, but doesn't load").
const capacitorBuildPath = "android/app/capacitor.build.gradle";
let capacitorBuild = readFileSync(capacitorBuildPath, "utf8");
capacitorBuild = capacitorBuild.replace(/^\s*implementation project\(':capacitor-community-admob'\)\s*$/m, "");
writeFileSync(capacitorBuildPath, capacitorBuild);

let mainActivity = readFileSync(mainActivityPath, "utf8");
mainActivity = mainActivity.replace(/^\s*registerPlugin\(UnityAdsPlugin\.class\);\s*$/m, "");
writeFileSync(mainActivityPath, mainActivity);
if (existsSync(unityPluginPath)) rmSync(unityPluginPath);

console.log("Store Android package sanitized: ads, calls, microphone, screen sharing, and external-app surfaces removed.");
// Drop AdMob from Capacitor's runtime plugin list so nothing tries to load it.
const pluginsJsonPath = "android/app/src/main/assets/capacitor.plugins.json";
if (existsSync(pluginsJsonPath)) {
  const plugins = JSON.parse(readFileSync(pluginsJsonPath, "utf8")) as Array<{ pkg?: string; classpath?: string }>;
  const kept = plugins.filter((p) => !/admob/i.test(`${p.pkg ?? ""} ${p.classpath ?? ""}`));
  writeFileSync(pluginsJsonPath, JSON.stringify(kept, null, "\t"));
}
const settingsGradlePath = "android/capacitor.settings.gradle";
if (existsSync(settingsGradlePath)) {
  writeFileSync(
    settingsGradlePath,
    readFileSync(settingsGradlePath, "utf8").replace(/^.*capacitor-community-admob.*$/gm, ""),
  );
}
