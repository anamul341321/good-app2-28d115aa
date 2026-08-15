import { Link, useLocation } from "@tanstack/react-router";
import { MessageCircle, Users, Home, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { listNotifications } from "@/lib/news-feed.functions";

export function MessengerNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const location = useLocation();
  const path = location.pathname;

  const { data: notificationsData } = useQuery({
    queryKey: ["social-notifications"],
    queryFn: () => listNotifications(),
    refetchInterval: 30000,
  });

  const unreadNotifCount = (notificationsData as any)?.notifications?.filter((n: any) => !n.read_at).length || 0;

  const NavItem = ({
    to,
    icon: Icon,
    label,
    badge,
  }: {
    to: string;
    icon: any;
    label: string;
    badge?: number;
  }) => {
    const active = path === to || (to !== "/social" && path.startsWith(to));
    return (
      <Link
        to={to as any}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-1 transition-colors relative",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <div className="relative">
          <Icon className={cn("h-6 w-6", active && "fill-current")} />
          {badge !== undefined && badge > 0 && (
            <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </div>
        <span className="text-[10px] font-black">{label}</span>
      </Link>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center border-t bg-background/95 backdrop-blur-xl px-4 pb-safe shadow-[0_-1px_10px_rgba(0,0,0,0.05)] border-primary/10">
      <NavItem to="/social" icon={Home} label="Social" />
      <NavItem to="/social/messenger" icon={MessageCircle} label="Chats" badge={unreadCount} />
      <NavItem to="/social/notifications" icon={Users} label="Notifs" badge={unreadNotifCount} />
      <Link to="/home" className="flex flex-1 flex-col items-center justify-center gap-1 text-muted-foreground hover:text-rose-500 transition-colors">
        <div className="relative">
          <ChevronLeft className="h-6 w-6" />
        </div>
        <span className="text-[10px] font-black">Dashboard</span>
      </Link>
    </div>
  );
}
