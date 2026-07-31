import { useQuery } from "@tanstack/react-query";
import { Bot, Loader2 } from "lucide-react";
import { getBotStartLink } from "@/lib/telegram-link.functions";
import { useLang } from "@/lib/i18n";

/** এক ক্লিকে টেলিগ্রাম বট চালু (start) করার বাটন। */
export function BotStartButton() {
  const { t } = useLang();
  const { data, isLoading } = useQuery({
    queryKey: ["bot-start-link"],
    queryFn: () => getBotStartLink(),
    staleTime: 30 * 60_000,
  });

  const url = data?.url ?? null;
  if (isLoading) {
    return (
      <div className="rounded-2xl p-3.5 text-center bg-muted/40 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!url) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
       className="block rounded-2xl p-3.5 text-center shadow-md btn-press"
       style={{ background: "linear-gradient(120deg,#7c3aed,#0088cc)" }}>
      <p className="text-sm font-black text-white flex items-center justify-center gap-1.5">
        <Bot className="w-4 h-4" /> {t("বট চালু করুন", "Start the bot")}
      </p>
      <p className="text-[11px] text-white/90 mt-0.5">
        {t("এক ক্লিকেই বট Start হবে — UID লিখতে হবে না", "One tap starts the bot — no UID needed")}
      </p>
    </a>
  );
}
