import { useEffect, useRef, useState } from "react";
import { Play, Pause, Trash2, Ban, PhoneMissed, PhoneIncoming, Video } from "lucide-react";

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
        <img src={url} alt="ছবি" className="max-h-full max-w-full rounded-2xl" />
      )}
    </div>
  );
}

function VoiceMessage({ url, mine, durationHint }: { url: string; mine: boolean; durationHint?: number }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(durationHint ?? 0);

  useEffect(() => {
    const node = audio.current;
    if (!node) return;
    const sync = () => setProgress(node.duration ? node.currentTime / node.duration : 0);
    const loaded = () => setDuration(Number.isFinite(node.duration) ? Math.round(node.duration) : durationHint ?? 0);
    const ended = () => { setPlaying(false); setProgress(0); };
    node.addEventListener("timeupdate", sync);
    node.addEventListener("loadedmetadata", loaded);
    node.addEventListener("ended", ended);
    return () => {
      node.removeEventListener("timeupdate", sync);
      node.removeEventListener("loadedmetadata", loaded);
      node.removeEventListener("ended", ended);
    };
  }, [durationHint]);

  const toggle = () => {
    const node = audio.current;
    if (!node) return;
    if (node.paused) void node.play().then(() => setPlaying(true)).catch(() => {});
    else { node.pause(); setPlaying(false); }
  };
  const seconds = Math.max(0, duration);

  return (
    <div className="flex min-w-56 items-center gap-2 py-0.5" onClick={(event) => event.stopPropagation()}>
      <audio ref={audio} src={url} preload="metadata" />
      <button onClick={toggle} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-current/15" aria-label={playing ? "Stop" : "Play"}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
      <div className="flex h-8 flex-1 items-center gap-0.5">
        {Array.from({ length: 28 }, (_, index) => {
          const active = index / 28 <= progress;
          return <span key={index} className={`w-0.5 rounded-full ${active ? "opacity-100" : "opacity-35"} ${mine ? "bg-white" : "bg-foreground"}`} style={{ height: `${7 + ((index * 13) % 20)}px` }} />;
        })}
      </div>
      <span className="w-9 text-right text-[10px] font-black opacity-75">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
    </div>
  );
}

export function MessageBubble({
  m,
  mine,
  showName,
  onDelete,
  seenBy,
}: {
  m: ChatMsg;
  mine: boolean;
  showName?: boolean;
  onDelete?: (id: string) => void;
  /** মেসেঞ্জারের মতো — পড়া হলে এই মেসেজের নিচে পিয়ারের ছোট প্রোফাইল ছবি দেখাবে */
  seenBy?: { name: string; avatarUrl?: string | null } | null;
}) {
  const [zoom, setZoom] = useState(false);
  const [menu, setMenu] = useState(false);


  const bubbleClasses = mine
    ? "bg-primary text-white rounded-[20px] rounded-br-[4px]"
    : "bg-surface-2 text-foreground rounded-[20px] rounded-bl-[4px]";

  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"} mb-1`}>
      <div className="max-w-[80%] flex items-end gap-2">
        <div
          onClick={() => mine && !m.deleted && setMenu((v) => !v)}
          className={`relative overflow-hidden shadow-sm transition-all ${bubbleClasses} ${
            m.kind === "image" || m.kind === "video" ? "p-1" : "px-3.5 py-2"
          }`}
        >
          {m.deleted ? (
            <p className="flex items-center gap-1.5 text-xs font-bold italic opacity-80">
              <Ban className="h-3.5 w-3.5" /> Message deleted
            </p>
          ) : m.kind === "call" ? (
            <div className="flex min-w-52 items-center gap-3 py-1">
              <span className={`grid h-10 w-10 place-items-center rounded-full ${
                m.mediaMeta?.status === "ended" ? "bg-white/20" : "bg-rose-500/20"
              }`}>
                {m.mediaMeta?.status === "ended" ? (
                  m.mediaMeta?.video ? <Video className="h-5 w-5" /> : <PhoneIncoming className="h-5 w-5" />
                ) : (
                  <PhoneMissed className="h-5 w-5" />
                )}
              </span>
              <div>
                <p className="text-sm font-black">{m.body}</p>
                <p className="text-[10px] font-bold opacity-75">{m.mediaMeta?.video ? "Video Call" : "Audio Call"}</p>
              </div>
            </div>
          ) : m.kind === "image" && m.mediaUrl ? (
            <img
              src={m.mediaUrl}
              alt="Image"
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
            <VoiceMessage url={m.mediaUrl} mine={mine} durationHint={Number(m.mediaMeta?.duration) || undefined} />
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm font-bold leading-snug">{m.body}</p>
          )}
        </div>
      </div>
      
      {/* Seen — মেসেঞ্জার স্টাইল ছোট প্রোফাইল ছবি */}
      {mine && seenBy && !m.deleted && (
        <span className="mr-0.5 mt-1 flex items-center gap-1">
          <MessengerAvatar name={seenBy.name} src={seenBy.avatarUrl ?? null} size="sm" className="!h-4 !w-4" />
        </span>
      )}

      {!mine && showName && (
        <span className="text-[9px] font-black text-muted-foreground ml-3 mt-0.5">{m.senderName}</span>
      )}

      {menu && mine && !m.deleted && onDelete && (
        <div className="mt-1 flex justify-end">
          <button
            onClick={() => {
              setMenu(false);
              onDelete(m.id);
            }}
            className="btn-press flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-[10px] font-black text-rose-500 border border-rose-500/20"
          >
            <Trash2 className="h-3 w-3" /> Unsend
          </button>
        </div>
      )}

      {zoom && m.mediaUrl && (
        <Lightbox url={m.mediaUrl} video={m.kind === "video"} onClose={() => setZoom(false)} />
      )}
    </div>
  );
}
