import { Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { MessengerAvatar } from "./MessengerAvatar";
import { cn } from "@/lib/utils";
import type { Gender } from "@/lib/default-avatar";
import { isRecentlyActive, shortLastActive } from "@/lib/last-active";
import { Trash2, Ban } from "lucide-react";

export function ChatRow({
  id,
  name,
  avatar,
  gender,
  uid,
  lastMessage,
  time,
  unreadCount,
  online,
  lastActiveAt,
  isGroup,
  onDelete,
}: {
  id: string;
  name: string;
  avatar?: string | null;
  gender?: Gender;
  uid?: number | null;
  lastMessage: string;
  time: string;
  unreadCount: number;
  online?: boolean;
  lastActiveAt?: string | null;
  isGroup?: boolean;
  /** লং-প্রেসে পুরো চ্যাট ডিলিট */
  onDelete?: (id: string, isGroup: boolean) => void;
}) {
  const isUnread = unreadCount > 0;
  const isOnline = Boolean(online) || isRecentlyActive(lastActiveAt);
  const awayFor = !isGroup && !isOnline ? shortLastActive(lastActiveAt) : null;
  const chatTarget = isGroup ? "/chat/group/$groupId" : "/chat/$peerId";
  const chatParams = isGroup ? { groupId: id } : { peerId: id };
  const [menu, setMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openMenu = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = "touches" in e ? e.touches[0]?.clientX || 0 : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY || 0 : e.clientY;
    setMenuPos({ x: Math.min(clientX, window.innerWidth - 170), y: Math.min(clientY, window.innerHeight - 120) });
    setMenu(true);
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    longPressTimer.current = setTimeout(() => openMenu(e), 500);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <>
      <div
        className="flex min-h-[76px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/70"
        onMouseDown={handlePointerDown}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchEnd={handlePointerUp}
        onTouchMove={handlePointerUp}
        onContextMenu={(e) => { e.preventDefault(); openMenu(e); }}
      >
        {!isGroup ? (
          <Link
            to="/user/$userId"
            params={{ userId: id }}
            onClick={(event) => event.stopPropagation()}
            className="btn-press rounded-full"
            aria-label={`${name} profile`}
          >
            <MessengerAvatar
              name={name}
              src={avatar}
              gender={gender}
              online={isOnline}
              size="xl"
            />
          </Link>
        ) : (
          <MessengerAvatar
            name={name}
            src={avatar}
            gender={gender}
            online={isOnline}
            size="xl"
          />
        )}
        <Link
          to={chatTarget as any}
          params={chatParams as any}
          className="btn-press flex-1 min-w-0"
        >
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              "truncate text-[17px] font-semibold leading-tight",
              isUnread ? "text-foreground" : "text-foreground"
            )}>
              {name}
            </span>
            <span className="shrink-0 text-[13px] font-medium text-muted-foreground">
              {time}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className={cn(
              "truncate text-[14px] leading-tight",
              isUnread ? "font-black text-foreground" : "font-medium text-muted-foreground"
            )}>
              {lastMessage}
            </p>
            {isUnread && (
              <div className="shrink-0 h-2.5 w-2.5 rounded-full bg-messenger-blue" />
            )}
          </div>
          {!isGroup && (
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground/75" translate="no">
              {uid ? <span>UID {uid}</span> : null}
              {isOnline ? (
                <span className="normal-case text-emerald-500">• Active now</span>
              ) : awayFor ? (
                <span className="normal-case">• {awayFor} আগে active</span>
              ) : null}
            </p>
          )}
        </Link>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setMenu(false)} />
          <div
            className="fixed z-[90] min-w-[170px] rounded-xl border border-border/60 bg-card/95 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            <button
              onClick={() => {
                setMenu(false);
                onDelete?.(id, !!isGroup);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-black text-rose-500 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" /> {isGroup ? "গ্রুপ ডিলিট" : "চ্যাট ডিলিট"}
            </button>
            <button
              onClick={() => setMenu(false)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-black text-foreground hover:bg-surface-2 transition-colors"
            >
              <Ban className="h-4 w-4" /> বন্ধ করুন
            </button>
          </div>
        </>
      )}
    </>
  );
}
