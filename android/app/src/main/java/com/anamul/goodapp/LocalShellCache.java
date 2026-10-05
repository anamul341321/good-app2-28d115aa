package com.anamul.goodapp;

import android.content.Context;
import android.net.Uri;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * কল/মেসেঞ্জার পাতাগুলোর একটা কপি ফোনের ভেতরেই রেখে দেয়।
 * - /assets/* ও /__l5e/* (নাম বদলায় না এমন ফাইল): একবার নামলে পরের বার সরাসরি ফোন থেকে।
 * - কল/চ্যাট পাতার HTML: আগের সেভ করা কপি সাথে সাথে দেখায়, পেছনে নতুনটা নামিয়ে রাখে।
 * ফলে কল অ্যাপ খোলা বা কল ধরার সময় ইন্টারনেটের জন্য অপেক্ষা করতে হয় না।
 * ডেটা (নাম, মেসেজ, কল) আগের মতোই ইন্টারনেট থেকে আসে।
 */
public final class LocalShellCache {
    private static final ExecutorService BG = Executors.newFixedThreadPool(2);
    private static final long MAX_AGE_MS = 21L * 24 * 60 * 60 * 1000;
    private final File assetDir;
    private final File pageDir;

    public LocalShellCache(Context ctx) {
        File root = new File(ctx.getFilesDir(), "shell-cache");
        assetDir = new File(root, "assets");
        pageDir = new File(root, "pages");
        assetDir.mkdirs();
        pageDir.mkdirs();
        BG.execute(this::cleanup);
    }

    private static boolean isAppHost(String host) {
        return "www.goodapp2.live".equals(host) || "goodapp2.live".equals(host);
    }

    private static boolean isShellPage(String path) {
        return path != null && path.matches("^/(calls|chat|callcenter)(/.*)?$");
    }

    public WebResourceResponse intercept(WebResourceRequest req) {
        try {
            if (!"GET".equalsIgnoreCase(req.getMethod())) return null;
            Uri u = req.getUrl();
            if (!"https".equals(u.getScheme()) || !isAppHost(u.getHost())) return null;
            String path = u.getPath() == null ? "/" : u.getPath();
            if (path.startsWith("/assets/") || path.startsWith("/__l5e/")) {
                return asset(u.toString(), path);
            }
            if (req.isForMainFrame() && isShellPage(path)) {
                return page(u.toString(), path, req.getRequestHeaders());
            }
        } catch (Exception ignored) {}
        return null;
    }

    private WebResourceResponse asset(String url, String path) throws Exception {
        File f = new File(assetDir, hash(path));
        File meta = new File(assetDir, hash(path) + ".type");
        if (f.exists() && meta.exists()) {
            f.setLastModified(System.currentTimeMillis());
            return respond(readString(meta), new FileInputStream(f));
        }
        Fetched r = fetch(url, null);
        if (r == null || r.code != 200) return null;
        write(f, r.body);
        write(meta, r.type.getBytes("UTF-8"));
        return respond(r.type, new ByteArrayInputStream(r.body));
    }

    private WebResourceResponse page(String url, String path, Map<String, String> headers) throws Exception {
        final File f = new File(pageDir, hash(path));
        if (f.exists()) {
            BG.execute(() -> refreshPage(url, f, headers));
            return respond("text/html", new FileInputStream(f));
        }
        Fetched r = fetch(url, headers);
        if (r == null || r.code != 200 || !r.type.startsWith("text/html")) return null;
        write(f, r.body);
        return respond(r.type, new ByteArrayInputStream(r.body));
    }

    private void refreshPage(String url, File f, Map<String, String> headers) {
        try {
            Fetched r = fetch(url, headers);
            if (r != null && r.code == 200 && r.type.startsWith("text/html")) write(f, r.body);
        } catch (Exception ignored) {}
    }

    private static final class Fetched { int code; String type; byte[] body; }

    private static Fetched fetch(String url, Map<String, String> headers) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(8000);
        c.setReadTimeout(15000);
        c.setInstanceFollowRedirects(false);
        if (headers != null) {
            for (Map.Entry<String, String> e : headers.entrySet()) c.setRequestProperty(e.getKey(), e.getValue());
        }
        try {
            String cookie = CookieManager.getInstance().getCookie(url);
            if (cookie != null) c.setRequestProperty("Cookie", cookie);
        } catch (Exception ignored) {}
        Fetched r = new Fetched();
        r.code = c.getResponseCode();
        if (r.code != 200) { c.disconnect(); return r; }
        String type = c.getContentType();
        r.type = type == null ? "application/octet-stream" : type.split(";")[0].trim();
        InputStream in = c.getInputStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        c.disconnect();
        r.body = out.toByteArray();
        return r;
    }

    private static WebResourceResponse respond(String type, InputStream body) {
        String mime = type == null ? "application/octet-stream" : type;
        WebResourceResponse res = new WebResourceResponse(mime, mime.startsWith("text/") || mime.contains("javascript") ? "UTF-8" : null, body);
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");
        res.setResponseHeaders(h);
        return res;
    }

    private static void write(File f, byte[] data) throws Exception {
        File tmp = new File(f.getPath() + ".tmp");
        FileOutputStream o = new FileOutputStream(tmp);
        o.write(data);
        o.close();
        tmp.renameTo(f);
    }

    private static String readString(File f) throws Exception {
        FileInputStream in = new FileInputStream(f);
        byte[] b = new byte[(int) f.length()];
        int read = in.read(b);
        in.close();
        return new String(b, 0, Math.max(read, 0), "UTF-8");
    }

    private static String hash(String s) throws Exception {
        byte[] d = MessageDigest.getInstance("SHA-1").digest(s.getBytes("UTF-8"));
        StringBuilder sb = new StringBuilder();
        for (byte b : d) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private void cleanup() {
        long cutoff = System.currentTimeMillis() - MAX_AGE_MS;
        File[] files = assetDir.listFiles();
        if (files == null) return;
        for (File f : files) if (f.lastModified() < cutoff) f.delete();
    }
}
