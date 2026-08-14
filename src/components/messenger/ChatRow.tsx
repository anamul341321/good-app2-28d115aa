import { Link } from "@tanstack/react-router";
import { MessengerAvatar } from "./MessengerAvatar";
import { cn } from "@/lib/utils";

export function ChatRow({
  id,
  name,
  avatar,
  lastMessage,
  time,
  unreadCount,
  online,
  isGroup,
}: {
  id: string;
  name: string;
  avatar?: string | null;
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
      className="btn-press flex items-center gap-3 px-4 py-3 hover:bg-surface-2/50 transition-colors"
    >
      <MessengerAvatar
        name={name}
        src={avatar}
        online={online}
        size="lg"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            "truncate text-sm font-black",
            isUnread ? "text-foreground" : "text-muted-foreground"
          )}>
            {name}
          </span>
          <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
            {time}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={cn(
            "truncate text-xs",
            isUnread ? "font-black text-foreground" : "font-bold text-muted-foreground"
          )}>
            {lastMessage}
          </p>
          {isUnread && (
            <div className="shrink-0 h-2.5 w-2.5 rounded-full bg-primary" />
          )}
        </div>
      </div>
    </Link>
  );
}
