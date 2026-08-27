import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/**
 * অ্যাডমিন প্যানেলের ভারী সেকশনগুলোর জন্য — যে সেকশনে ক্লিক করা হবে
 * শুধু সেটিরই ডেটা লোড হবে, সব একসাথে লোড হয়ে ফোন আটকে যাবে না।
 */
export function CollapsibleSection({
  title,
  subtitle,
  open,
  onToggle,
  accent = "cyan",
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  accent?: string;
  children: ReactNode;
}) {
  return (
    <div className="glass rounded-xl mb-3 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-3 text-left btn-press"
      >
        <span className="min-w-0">
          <span
            className={`block text-[11px] font-black uppercase tracking-widest ${
              accent === "emerald"
                ? "text-emerald"
                : accent === "violet"
                  ? "text-violet"
                  : accent === "amber"
                    ? "text-amber"
                    : "text-cyan"
            }`}
          >
            {title}
          </span>
          {subtitle && <span className="block text-[10px] text-muted-foreground truncate">{subtitle}</span>}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
