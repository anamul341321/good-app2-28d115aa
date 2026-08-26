import { useRouter, Link } from "@tanstack/react-router";
import { ArrowLeft, Home } from "lucide-react";

type Props = {
  title?: string;
  /** Fallback route when there is no history to go back to */
  fallbackTo?: string;
  showHome?: boolean;
};

/**
 * Reusable sticky back header for inner pages.
 * Keeps a safe tap offset from the status bar via the `safe-top` utility.
 */
export function PageBackHeader({ title, fallbackTo = "/home", showHome = true }: Props) {
  const router = useRouter();

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
      return;
    }
    router.navigate({ to: fallbackTo });
  };

  return (
    <div className="safe-top sticky top-0 z-40 -mx-4 mb-3 flex items-center gap-2 border-b border-border/60 bg-background/95 px-3 pb-2 backdrop-blur">
      <button
        type="button"
        onClick={goBack}
        aria-label="পিছনে যান"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground active:scale-95"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      {title ? (
        <h1 className="min-w-0 flex-1 truncate text-base font-black text-foreground">{title}</h1>
      ) : (
        <span className="flex-1" />
      )}
      {showHome && (
        <Link
          to="/home"
          aria-label="ড্যাশবোর্ড"
          className="flex h-10 items-center gap-1 rounded-full bg-primary/10 px-3 text-xs font-black text-primary active:scale-95"
        >
          <Home className="h-4 w-4" />
          ড্যাশবোর্ড
        </Link>
      )}
    </div>
  );
}

export default PageBackHeader;
