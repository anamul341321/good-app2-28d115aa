import { Link } from "@tanstack/react-router";
import { MessengerAvatar } from "./MessengerAvatar";
import { cn } from "@/lib/utils";

export function ChatRow({
  id,
  name,
  avatar,
  uid,
  lastMessage,
  time,
  unreadCount,
  online,
  isGroup,
}: {
  id: string;
  name: string;
  avatar?: string | null;
  uid?: number | null;
  lastMessage: string;
  time: string;
  unreadCount: number;
  online?: boolean;
  isGroup?: boolean;
}) {
  const isUnread = unreadCount > 0;
  
  return (
    <Link
      to={isGroup ? "/chat/group/$groupId" : "/chat/$peerId"}
      params={isGroup ? { groupId: id } : { peerId: id }}
      className="btn-press flex min-h-[76px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2/70"
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
            online={online}
            size="xl"
          />
        </Link>
      ) : (
        <MessengerAvatar
          name={name}
          src={avatar}
          online={online}
          size="xl"
        />
      )}
      <div className="flex-1 min-w-0">
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
      </div>
    </Link>
  );
}
