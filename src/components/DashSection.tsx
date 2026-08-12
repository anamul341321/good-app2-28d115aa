import type { ReactNode } from "react";

/**
 * Dashboard section wrapper — gives every group of cards its own titled,
 * visually separated block so the home screen reads as clear sections
 * instead of one long pile of cards.
 */
export function DashSection({
  icon,
  title,
  subtitle,
  tint = "violet",
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  tint?: "violet" | "cyan" | "amber" | "emerald" | "rose";
  children: ReactNode;
  action?: ReactNode;
}) {
  const TINTS: Record<string, string> = {
    violet: "linear-gradient(135deg,#8b5cf6,#6366f1)",
    cyan: "linear-gradient(135deg,#06b6d4,#3b82f6)",
    amber: "linear-gradient(135deg,#f59e0b,#ef4444)",
    emerald: "linear-gradient(135deg,#10b981,#06b6d4)",
    rose: "linear-gradient(135deg,#f43f5e,#ec4899)",
  };
  return (
    <section className="dash-section">
      <div className="flex items-center gap-2.5 px-1">
        <span
          className="shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center text-white shadow-lg"
          style={{ background: TINTS[tint] }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-black text-navy leading-tight truncate">{title}</h2>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground font-bold leading-tight truncate">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className="mt-2.5 space-y-3">{children}</div>
    </section>
  );
}
