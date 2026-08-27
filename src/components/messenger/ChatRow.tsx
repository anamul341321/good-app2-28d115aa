import { Link } from "@tanstack/react-router";
import { MessengerAvatar } from "./MessengerAvatar";
import { cn } from "@/lib/utils";
import type { Gender } from "@/lib/default-avatar";
import { isRecentlyActive, shortLastActive } from "@/lib/last-active";

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
}) {
  const isUnread = unreadCount > 0;
  const isOnline = Boolean(online) || isRecentlyActive(lastActiveAt);
  const awayFor = !isGroup && !isOnline ? shortLastActive(lastActiveAt) : null;
  const chatTarget = isGroup ? "/chat/group/$groupId" : "/chat/$peerId";
  const chatParams = isGroup ? { groupId: id } : { peerId: id };
  
  return (
    <div className="flex min-h-[76px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/70">
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
        {uid && !isGroup && (
          <p className="mt-0.5 text-[10px] font-semibold uppercase text-muted-foreground/75" translate="no">
            UID {uid}
          </p>
        )}
      </Link>
    </div>
  );
}
