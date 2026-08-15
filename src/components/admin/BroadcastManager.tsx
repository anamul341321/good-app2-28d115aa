import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Loader2, Pause, History, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  adminListCampaigns,
  adminCreateCampaign,
  adminProcessBroadcast,
  adminUpdateCampaignStatus,
} from "@/lib/telegram-broadcast.functions";

export function BroadcastManager() {
  const [isCreating, setIsCreating] = useState(false);
  const [target, setTarget] = useState("dm");
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  const { data: campaigns, refetch } = useQuery({
    queryKey: ["tg-campaigns"],
    queryFn: () => adminListCampaigns(),
    refetchInterval: 5000,
  });

  const process = useMutation({
    mutationFn: adminProcessBroadcast,
    onSuccess: (res: any) => {
      if (res?.status === "sending" && activeCampaignId) {
        process.mutate({ data: { campaignId: activeCampaignId } });
      }
    },
  });

  const create = useMutation({
    mutationFn: adminCreateCampaign,
    onSuccess: () => {
      toast.success("ব্রডকাস্ট শুরু হলো");
      setIsCreating(false);
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    const active = campaigns?.find((c: any) => c.status === "sending" || c.status === "pending");
    if (active && active.id !== activeCampaignId) {
      setActiveCampaignId(active.id);
      process.mutate({ data: { campaignId: active.id } });
    }
  }, [campaigns, activeCampaignId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-sm flex items-center gap-2">
          <Radio className="h-4 w-4 text-cyan" /> Background Broadcast
        </h3>
        <button
          onClick={() => setIsCreating(true)}
          className="gradient-cta rounded-xl px-3 py-2 text-xs font-black flex items-center gap-2"
        >
          <Send className="h-3.5 w-3.5" /> নতুন ব্রডকাস্ট
        </button>
      </div>

      {isCreating && (
        <div className="glass rounded-2xl p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              create.mutate({
                data: {
                  text: fd.get("text") as string,
                  target: fd.get("target") as any,
                  uids: (fd.get("uids") as string) || undefined,
                },
              });
            }}
            className="space-y-3"
          >
            <textarea
              name="text"
              required
              rows={4}
              placeholder="মেসেজ লিখুন..."
              className="w-full bg-surface-2 border border-border rounded-2xl p-3 text-xs font-bold outline-none"
            />
            <select
              name="target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl h-10 px-3 text-xs font-black"
            >
              <option value="dm">সব লিংক করা ইউজার (DM)</option>
              <option value="uid">নির্দিষ্ট UID (একজন/অনেকজন)</option>
              <option value="group">ডিফল্ট গ্রুপ চ্যাট</option>
            </select>
            {target === "uid" && (
              <textarea
                name="uids"
                rows={2}
                required
                placeholder="UID গুলো — কমা/স্পেস/নতুন লাইনে (যেমন: 1024, 1188 3001)"
                className="w-full bg-surface-2 border border-border rounded-2xl p-3 text-xs font-bold outline-none"
              />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="rounded-xl bg-surface-2 border border-border px-3 py-2 text-xs font-black"
              >
                বাতিল
              </button>
              <button disabled={create.isPending} className="gradient-cta rounded-xl px-3 py-2 text-xs font-black flex items-center gap-2">
                {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                শুরু করুন
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        <h4 className="font-black text-xs flex items-center gap-2 text-muted-foreground">
          <History className="h-3.5 w-3.5" /> ক্যাম্পেইন
        </h4>
        {(campaigns ?? []).map((c: any) => {
          const done = (c.sent_count || 0) + (c.failed_count || 0);
          const progress = (c.total_users || 0) > 0 ? (done / (c.total_users || 1)) * 100 : 0;
          return (
            <div key={c.id} className="glass rounded-2xl p-4 flex items-center gap-4">
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black text-[11px] truncate">{String(c.text).slice(0, 60)}</p>
                  <span
                    className={cn(
                      "text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0",
                      c.status === "sending" ? "bg-amber-500/10 text-amber-500" :
                      c.status === "completed" ? "bg-emerald-500/10 text-emerald-500" :
                      "bg-slate-500/10 text-slate-400",
                    )}
                  >
                    {c.status}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex gap-3 text-[9px] font-black text-muted-foreground uppercase">
                  <span>Sent: {c.sent_count || 0}</span>
                  <span>Failed: {c.failed_count || 0}</span>
                  <span>Total: {c.total_users || 0}</span>
                  <span className="ml-auto">{progress.toFixed(0)}%</span>
                </div>
              </div>
              {c.status === "sending" && (
                <button
                  onClick={() => adminUpdateCampaignStatus({ data: { campaignId: c.id, status: "paused" } }).then(() => refetch())}
                  className="p-2 bg-surface-2 rounded-xl border border-border"
                >
                  <Pause className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
