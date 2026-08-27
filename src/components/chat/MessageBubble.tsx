import { useEffect, useRef, useState } from "react";
import { Play, Pause, Trash2, Ban, PhoneMissed, PhoneIncoming, Video, Reply } from "lucide-react";
import { useFeedMedia } from "@/lib/feed-media";

/** মেসেজ সিন হলে নিচে দেখানো ছোট (১৬px) প্রোফাইল ছবি */
function SeenAvatar({ name, src }: { name: string; src?: string | null }) {
  const url = useFeedMedia(src);
  return (
    <span
      className="mr-0.5 mt-1 grid h-4 w-4 place-items-center overflow-hidden rounded-full bg-surface-3 text-[8px] font-black text-foreground/70 ring-1 ring-border/60"
      title={`${name} দেখেছেন`}
    >
      {url ? <img src={url} alt={name} className="h-full w-full object-cover" /> : (name || "U").slice(0, 1).toUpperCase()}
    </span>
  );
}


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

function VoiceMessage({
  url,
  mine,
  durationHint,
  peaks,
}: {
  url: string;
  mine: boolean;
  durationHint?: number;
  peaks?: number[];
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(durationHint ?? 0);
  const [bars, setBars] = useState<number[]>(peaks && peaks.length ? peaks : []);

  useEffect(() => {
    setBars(peaks && peaks.length ? peaks : []);
  }, [peaks?.length, url]);

  // পুরোনো মেসেজে peaks নেই — অডিও ডিকোড করে আসল ওয়েভফর্ম বানানো হয়।
  useEffect(() => {
    if (bars.length) return;
    let cancelled = false;
    (async () => {
      try {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return;
        const response = await fetch(url);
        if (!response.ok) return;
        const buffer = await response.arrayBuffer();
        const ctx = new Ctor();
        const decoded = await ctx.decodeAudioData(buffer.slice(0));
        await ctx.close().catch(() => {});
        if (cancelled) return;
        setBars(computePeaks(decoded.getChannelData(0), VOICE_PEAK_COUNT));
        if (Number.isFinite(decoded.duration)) setDuration(decoded.duration);
      } catch {
        /* ডিকোড না হলে ফ্ল্যাট বার দেখাবে */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, bars.length]);

  useEffect(() => {
    const node = audio.current;
    if (!node) return;
    const total = () => (Number.isFinite(node.duration) && node.duration > 0 ? node.duration : durationHint ?? 0);
    const sync = () => {
      const length = total();
      setProgress(length ? Math.min(1, node.currentTime / length) : 0);
    };
    const loaded = () => {
      const length = total();
      if (length) setDuration(length);
    };
    const ended = () => {
      setPlaying(false);
      setProgress(0);
      node.currentTime = 0;
    };
    node.addEventListener("timeupdate", sync);
    node.addEventListener("loadedmetadata", loaded);
    node.addEventListener("durationchange", loaded);
    node.addEventListener("playing", () => setPlaying(true));
    node.addEventListener("pause", () => setPlaying(false));
    node.addEventListener("ended", ended);
    return () => {
      node.removeEventListener("timeupdate", sync);
      node.removeEventListener("loadedmetadata", loaded);
      node.removeEventListener("durationchange", loaded);
      node.removeEventListener("ended", ended);
    };
  }, [durationHint]);

  const toggle = () => {
    const node = audio.current;
    if (!node) return;
    if (node.paused) void node.play().then(() => setPlaying(true)).catch(() => {});
    else {
      node.pause();
      setPlaying(false);
    }
  };
  const seconds = Math.max(0, Math.round(duration));
  const shape = bars.length ? bars : Array.from({ length: VOICE_PEAK_COUNT }, () => 0.35);

  const seek = (event: React.MouseEvent<HTMLDivElement>) => {
    const node = audio.current;
    const length = duration;
    if (!node || !length) return;
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    node.currentTime = ratio * length;
    setProgress(ratio);
  };

  return (
    <div className="flex min-w-56 items-center gap-2 py-0.5" onClick={(event) => event.stopPropagation()}>
      <audio ref={audio} src={url} preload="metadata" />
      <button onClick={toggle} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-current/15" aria-label={playing ? "Stop" : "Play"}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
      <div className="flex h-8 flex-1 cursor-pointer items-center gap-0.5" onClick={seek}>
        {shape.map((value, index) => {
          const active = index / shape.length <= progress;
          return (
            <span
              key={index}
              className={`flex-1 rounded-full ${active ? "opacity-100" : "opacity-35"} ${mine ? "bg-white" : "bg-foreground"}`}
              style={{ height: `${Math.max(3, Math.round(value * 26))}px` }}
            />
          );
        })}
      </div>
      <span className="w-9 text-right text-[10px] font-black opacity-75">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
    </div>
  );
}


/** লং-প্রেস মেনু — মেসেঞ্জারের মতো */
function MessageContextMenu({
  open,
  onClose,
  onDelete,
  onReply,
  mine,
  position,
}: {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  onReply?: () => void;
  mine: boolean;
  position: { x: number; y: number };
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[80]" onClick={onClose} />
      <div
        className="fixed z-[90] min-w-[160px] rounded-xl border border-border/60 bg-card/95 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
        style={{ left: position.x, top: position.y }}
      >
        {onReply && (
          <button
            onClick={() => {
              onClose();
              onReply();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-black text-foreground hover:bg-surface-2 transition-colors"
          >
            <Reply className="h-4 w-4" /> রিপ্লাই দিন
          </button>
        )}
        {mine && (
          <button
            onClick={() => {
              onClose();
              onDelete();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-black text-rose-500 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" /> Unsend / মুছুন
          </button>
        )}
        <button
          onClick={onClose}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-black text-foreground hover:bg-surface-2 transition-colors"
        >
          <Ban className="h-4 w-4" /> বন্ধ করুন
        </button>
      </div>
    </>
  );
}

export function MessageBubble({
  m,
  mine,
  showName,
  onDelete,
  onReply,
  seenBy,
}: {
  m: ChatMsg;
  mine: boolean;
  showName?: boolean;
  onDelete?: (id: string) => void;
  /** ডান দিকে টান দিলে এই মেসেজ mention করে রিপ্লাই লেখা শুরু হবে */
  onReply?: (m: ChatMsg) => void;
  /** মেসেঞ্জারের মতো — পড়া হলে এই মেসেজের নিচে পিয়ারের ছোট প্রোফাইল ছবি দেখাবে */
  seenBy?: { name: string; avatarUrl?: string | null } | null;
}) {
  const [zoom, setZoom] = useState(false);
  const [menu, setMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState(0);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const replyTo = (m.mediaMeta as any)?.replyTo as
    | { body?: string; name?: string; kind?: string }
    | undefined;

  const openMenu = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = "touches" in e ? e.touches[0]?.clientX || 0 : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY || 0 : e.clientY;
    setMenuPos({ x: Math.min(clientX, window.innerWidth - 170), y: Math.min(clientY, window.innerHeight - 120) });
    setMenu(true);
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (m.deleted) return;
    if ("touches" in e && e.touches[0]) {
      startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    longPressTimer.current = setTimeout(() => openMenu(e), 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerUp = () => {
    cancelLongPress();
    if (drag > 45 && onReply && !m.deleted) {
      onReply(m);
      if (navigator.vibrate) navigator.vibrate(15);
    }
    startRef.current = null;
    setDrag(0);
  };

  // ডান দিকে টান — মেসেঞ্জারের মতো রিপ্লাই
  const handleTouchMove = (e: React.TouchEvent) => {
    const start = startRef.current;
    const touch = e.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = Math.abs(touch.clientY - start.y);
    if (dy > 24) {
      cancelLongPress();
      setDrag(0);
      return;
    }
    if (dx > 6) {
      cancelLongPress();
      setDrag(Math.min(dx, 72));
    } else {
      cancelLongPress();
    }
  };

  const bubbleClasses = mine
    ? "bg-primary text-white rounded-[20px] rounded-br-[4px]"
    : "bg-surface-2 text-foreground rounded-[20px] rounded-bl-[4px]";

  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"} mb-1`}>
      <div className="relative max-w-[80%] flex items-end gap-2">
        {drag > 10 && (
          <span
            className="pointer-events-none absolute -left-8 top-1/2 -translate-y-1/2 text-primary"
            style={{ opacity: Math.min(1, drag / 45) }}
          >
            <Reply className="h-5 w-5" />
          </span>
        )}
        <div
          ref={bubbleRef}
          onMouseDown={handlePointerDown}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchEnd={handlePointerUp}
          onTouchCancel={handlePointerUp}
          onTouchMove={handleTouchMove}
          onDoubleClick={() => !m.deleted && onReply?.(m)}
          onContextMenu={(e) => { e.preventDefault(); openMenu(e); }}
          onClick={() => mine && !m.deleted && setMenu((v) => !v)}
          style={{ transform: `translateX(${drag}px)`, transition: drag ? "none" : "transform 160ms ease-out" }}
          className={`relative overflow-hidden shadow-sm ${bubbleClasses} ${
            m.kind === "image" || m.kind === "video" ? "p-1" : "px-3.5 py-2"
          }`}
        >
          {replyTo && !m.deleted && (
            <div
              className={`mb-1.5 rounded-xl border-l-4 px-2.5 py-1.5 ${
                mine ? "border-white/70 bg-white/15" : "border-primary/70 bg-primary/10"
              }`}
            >
              <p className="text-[10px] font-black opacity-90">{replyTo.name ?? "মেসেজ"}</p>
              <p className="line-clamp-2 text-[11px] font-bold opacity-80">
                {replyTo.body?.trim()
                  ? replyTo.body
                  : replyTo.kind === "image"
                    ? "📷 ছবি"
                    : replyTo.kind === "video"
                      ? "🎬 ভিডিও"
                      : replyTo.kind === "voice"
                        ? "🎤 ভয়েস"
                        : "মেসেজ"}
              </p>
            </div>
          )}

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
            <p className="whitespace-pre-wrap break-words text-sm font-black leading-snug">{m.body}</p>
          )}
        </div>
      </div>
      
      {/* Seen — মেসেঞ্জার স্টাইল ছোট প্রোফাইল ছবি */}
      {mine && seenBy && !m.deleted && (
        <SeenAvatar name={seenBy.name} src={seenBy.avatarUrl ?? null} />
      )}


      {!mine && showName && (
        <span className="text-[9px] font-black text-muted-foreground ml-3 mt-0.5">{m.senderName}</span>
      )}

      <MessageContextMenu
        open={menu}
        onClose={() => setMenu(false)}
        onDelete={() => onDelete?.(m.id)}
        onReply={onReply ? () => onReply(m) : undefined}
        mine={mine}
        position={menuPos}
      />

      {zoom && m.mediaUrl && (
        <Lightbox url={m.mediaUrl} video={m.kind === "video"} onClose={() => setZoom(false)} />
      )}
    </div>
  );
}
