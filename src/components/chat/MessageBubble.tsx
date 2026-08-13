import { useState } from "react";
import { Play, Trash2, Ban, PhoneMissed, PhoneIncoming, Video } from "lucide-react";

export type ChatMsg = {
  id: string;
  senderId: string;
  senderName?: string;
  body: string;
  kind: string;
  mediaUrl: string | null;
  mediaMeta: any;
  readAt: string | null;
  createdAt: string;
  deleted: boolean;
};

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });
}

/** ছবি/ভিডিও বড় করে দেখা */
function Lightbox({ url, video, onClose }: { url: string; video?: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[92] grid place-items-center bg-black/90 p-3" onClick={onClose}>
      {video ? (
        <video src={url} controls autoPlay className="max-h-full max-w-full rounded-2xl" />
      ) : (
        <img src={url} alt="চ্যাটের ছবি" className="max-h-full max-w-full rounded-2xl" />
      )}
    </div>
  );
}

export function MessageBubble({
  m,
  mine,
  showName,
  onDelete,
}: {
  m: ChatMsg;
  mine: boolean;
  showName?: boolean;
  onDelete?: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(false);
  const [menu, setMenu] = useState(false);

  const shell = mine
    ? "gradient-cta rounded-br-md text-white"
    : "rounded-bl-md bg-surface-2 text-foreground";

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%]">
        {showName && !mine && (
          <p className="mb-0.5 pl-2 text-[10px] font-black text-muted-foreground">{m.senderName}</p>
        )}
        <div
          onClick={() => mine && !m.deleted && setMenu((v) => !v)}
          className={`relative overflow-hidden rounded-2xl shadow-lg ${shell} ${
            m.kind === "image" || m.kind === "video" ? "p-1" : "px-3.5 py-2.5"
          }`}
        >
          {m.deleted ? (
            <p className="flex items-center gap-1.5 text-xs font-bold italic opacity-80">
              <Ban className="h-3.5 w-3.5" /> মেসেজ মুছে ফেলা হয়েছে
            </p>
          ) : m.kind === "call" ? (
            <div className="flex min-w-52 items-center gap-3 py-1">
              <span className={`grid h-10 w-10 place-items-center rounded-full ${
                m.mediaMeta?.status === "ended" ? "bg-emerald-500/20" : "bg-rose-500/20"
              }`}>
                {m.mediaMeta?.status === "ended" ? (
                  m.mediaMeta?.video ? <Video className="h-5 w-5" /> : <PhoneIncoming className="h-5 w-5" />
                ) : (
                  <PhoneMissed className="h-5 w-5" />
                )}
              </span>
              <div>
                <p className="text-sm font-black">{m.body}</p>
                <p className="text-[10px] font-bold opacity-75">{m.mediaMeta?.video ? "ভিডিও কল" : "অডিও কল"}</p>
              </div>
            </div>
          ) : m.kind === "image" && m.mediaUrl ? (
            <img
              src={m.mediaUrl}
              alt="ছবি"
              onClick={(e) => {
                e.stopPropagation();
                setZoom(true);
              }}
              className="max-h-72 w-56 rounded-xl object-cover"
              loading="lazy"
            />
          ) : m.kind === "video" && m.mediaUrl ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoom(true);
              }}
              className="relative block"
            >
              <video src={m.mediaUrl} className="max-h-72 w-56 rounded-xl object-cover" muted />
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-black/60 text-white">
                  <Play className="h-6 w-6" />
                </span>
              </span>
            </button>
          ) : m.kind === "voice" && m.mediaUrl ? (
            <audio src={m.mediaUrl} controls className="h-10 w-52" />
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm font-bold">{m.body}</p>
          )}

          <p
            className={`px-1 pt-1 text-[10px] font-black ${
              mine ? "text-white/75" : "text-muted-foreground"
            }`}
          >
            {timeOf(m.createdAt)} {mine && !m.deleted ? (m.readAt ? "✓✓ সিন" : "✓ পাঠানো") : ""}
          </p>
        </div>

        {menu && mine && !m.deleted && onDelete && (
          <div className="mt-1 flex justify-end">
            <button
              onClick={() => {
                setMenu(false);
                onDelete(m.id);
              }}
              className="btn-press flex items-center gap-1.5 rounded-xl bg-rose-500/15 px-3 py-1.5 text-[11px] font-black text-rose-500"
            >
              <Trash2 className="h-3.5 w-3.5" /> মেসেজ মুছুন
            </button>
          </div>
        )}
      </div>

      {zoom && m.mediaUrl && (
        <Lightbox url={m.mediaUrl} video={m.kind === "video"} onClose={() => setZoom(false)} />
      )}
    </div>
  );
}
