import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useFeedMedia } from "@/lib/feed-media";
import { defaultAvatarPath, type Gender } from "@/lib/default-avatar";

export function MessengerAvatar({
  name,
  src,
  gender,
  online,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  gender?: Gender;
  online?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const resolvedSrc = useFeedMedia(src);
  const fallbackSrc = defaultAvatarPath(gender);
  const finalSrc = resolvedSrc || fallbackSrc;
  const sizeClasses = {
    sm: "h-8 w-8 text-[10px]",
    md: "h-12 w-12 text-sm",
    lg: "h-14 w-14 text-base",
    xl: "h-16 w-16 text-lg",
  };

  const indicatorClasses = {
    sm: "h-2.5 w-2.5 border-2",
    md: "h-3.5 w-3.5 border-2",
    lg: "h-4 w-4 border-2",
    xl: "h-4.5 w-4.5 border-3",
  };

  return (
    <div className={cn("relative shrink-0", className)}>
      <Avatar className={cn(sizeClasses[size], "border border-border/50 shadow-sm")}>
        {finalSrc && <AvatarImage src={finalSrc} alt={name} className="object-cover" />}
        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 font-black text-primary uppercase">
          {(name || "U").toString().slice(0, 1)}
        </AvatarFallback>
      </Avatar>

      {online && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-background bg-emerald-500 shadow-sm",
            indicatorClasses[size]
          )}
        />
      )}
    </div>
  );
}
