/**
 * চ্যাটের ছবি/ভিডিও/ভয়েস আপলোড — ফাইল সোজা স্টোরেজে যায় (নিজের ফোল্ডারে),
 * তারপর শুধু পাথটা মেসেজের সাথে সেভ হয়।
 */
import { supabase } from "@/integrations/supabase/client";

export type UploadKind = "image" | "video" | "voice";

const MAX: Record<UploadKind, number> = {
  image: 12 * 1024 * 1024,
  video: 60 * 1024 * 1024,
  voice: 25 * 1024 * 1024,
};

// একই ফাইল একাধিকবার ট্যাপ করলে যেন দুবার আপলোড না হয় — চলমান আপলোড শেয়ার করি।
const inflight = new Map<string, Promise<string>>();

export async function uploadChatFile(file: Blob, kind: UploadKind, ext: string) {
  const dedupeKey = `${kind}:${file.size}:${(file as File).name ?? ""}:${(file as File).lastModified ?? ""}`;
  const running = inflight.get(dedupeKey);
  if (running) return running;
  const task = uploadChatFileOnce(file, kind, ext);
  inflight.set(dedupeKey, task);
  try {
    return await task;
  } finally {
    inflight.delete(dedupeKey);
  }
}

async function uploadChatFileOnce(file: Blob, kind: UploadKind, ext: string) {
  const { data } = await supabase.auth.getSession();
  const me = data.session?.user?.id;
  if (!me) throw new Error("লগইন করুন");
  if (file.size > MAX[kind]) throw new Error("ফাইলটি অনেক বড়");

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${me}/${kind}/${id}.${ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin"}`;

  const { error } = await supabase.storage.from("chat-media").upload(path, file, {
    contentType: file.type || undefined,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error("আপলোড হয়নি — ইন্টারনেট চেক করুন");
  return path;
}

export function extOf(name: string, fallback: string) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m?.[1] ?? fallback;
}
