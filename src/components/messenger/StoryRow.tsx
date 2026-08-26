import { Plus } from "lucide-react";
import { MessengerAvatar } from "./MessengerAvatar";
import { Link } from "@tanstack/react-router";

export type StoryItem = {
  userId: string;
  name: string;
  avatar?: string | null;
  online?: boolean;
  hasStory?: boolean;
};

export function StoryRow({
  activeUsers,
  onCreateStory,
}: {
  activeUsers: StoryItem[];
  onCreateStory?: () => void;
}) {
  const users = activeUsers.slice(0, 18);

  return (
    <div className="flex w-full gap-4 overflow-x-auto px-4 py-3 no-scrollbar">
      {/* Create Story */}
      <div className="flex shrink-0 flex-col items-center gap-1.5 w-20">
        <button
          onClick={onCreateStory}
          className="relative flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 transition-colors hover:bg-surface-2/80"
        >
          <div className="flex h-full w-full items-center justify-center rounded-full bg-surface-2">
            <Plus className="h-6 w-6 text-foreground" />
          </div>
          <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-messenger-blue text-primary-foreground">
            <Plus className="h-3 w-3" />
          </span>
        </button>
        <span className="w-full truncate text-center text-[13px] font-medium text-muted-foreground">
          Create
        </span>
      </div>

      {/* Active Users / Stories */}
      {users.map((user) => (
        <Link
          key={user.userId}
          to="/chat/$peerId"
          params={{ peerId: user.userId }}
          className="btn-press flex shrink-0 flex-col items-center gap-1.5 w-20"
        >
          <div className={user.hasStory ? "rounded-full border-2 border-messenger-blue p-[2px]" : ""}>
            <MessengerAvatar
              name={user.name}
              src={user.avatar}
              online={user.online}
              size="xl"
            />
          </div>
          <span className="w-full truncate text-center text-[13px] font-medium text-foreground/80">
            {user.name.split(" ")[0]}
          </span>
        </Link>
      ))}
    </div>
  );
}
