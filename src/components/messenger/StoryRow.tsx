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
  return (
    <div className="flex w-full gap-3 overflow-x-auto px-4 py-2 no-scrollbar">
      {/* Create Story */}
      <div className="flex shrink-0 flex-col items-center gap-1.5 w-16">
        <button
          onClick={onCreateStory}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-3">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary text-white">
            <Plus className="h-3 w-3" />
          </span>
        </button>
        <span className="w-full truncate text-center text-[10px] font-bold text-muted-foreground">
          Create Story
        </span>
      </div>

      {/* Active Users / Stories */}
      {activeUsers.map((user) => (
        <Link
          key={user.userId}
          to="/chat/$peerId"
          params={{ peerId: user.userId }}
          className="btn-press flex shrink-0 flex-col items-center gap-1.5 w-16"
        >
          <div className={user.hasStory ? "rounded-full p-[2px] border-2 border-primary" : ""}>
            <MessengerAvatar
              name={user.name}
              src={user.avatar}
              online={user.online}
              size="lg"
            />
          </div>
          <span className="w-full truncate text-center text-[10px] font-bold text-muted-foreground">
            {user.name.split(" ")[0]}
          </span>
        </Link>
      ))}
    </div>
  );
}
