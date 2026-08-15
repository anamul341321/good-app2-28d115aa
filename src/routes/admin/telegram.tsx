import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  adminListCampaigns, 
  adminCreateCampaign, 
  adminProcessBroadcast, 
  adminUpdateCampaignStatus 
} from "@/lib/telegram-broadcast.functions";
import { 
  Send, 
  Loader2, 
  Play, 
  Pause, 
  XCircle, 
  History, 
  Radio,
  Users,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/telegram")({
  component: TelegramBroadcastPage,
});

function TelegramBroadcastPage() {
  const qc = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  
  const { data: campaigns, refetch } = useQuery({
    queryKey: ["tg-campaigns"],
    queryFn: () => adminListCampaigns(),
    refetchInterval: 5000,
  });

  const create = useMutation({
    mutationFn: adminCreateCampaign,
    onSuccess: () => {
      toast.success("Broadcast initiated");
      setIsCreating(false);
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const process = useMutation({
    mutationFn: adminProcessBroadcast,
    onSuccess: (res) => {
      if (res.status === "sending") {
        // Continue processing
        process.mutate({ campaignId: activeCampaignId! });
      }
    }
  });

  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  useEffect(() => {
    const active = campaigns?.find(c => c.status === "sending");
    if (active && active.id !== activeCampaignId) {
      setActiveCampaignId(active.id);
      process.mutate({ campaignId: active.id });
    }
  }, [campaigns, activeCampaignId]);

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black flex items-center gap-3">
          <Radio className="h-7 w-7 text-primary" />
          Broadcast Manager
        </h1>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-primary text-white px-4 py-2 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg shadow-primary/20 btn-press"
        >
          <Send className="h-4 w-4" />
          New Broadcast
        </button>
      </div>

      {isCreating && (
        <div className="bg-surface-1 border p-6 rounded-3xl animate-in fade-in zoom-in-95">
          <h2 className="font-black mb-4">Draft Broadcast</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            create.mutate({ 
              text: fd.get("text") as string,
              target: fd.get("target") as any
            });
          }} className="space-y-4">
            <textarea name="text" required rows={4} placeholder="Enter message text..." className="w-full bg-surface-2 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 ring-primary/20 outline-none" />
            <select name="target" className="w-full bg-surface-2 border-none rounded-xl h-11 px-4 text-sm font-bold">
              <option value="dm">All Linked Users (DM)</option>
              <option value="group">Default Group Chat</option>
            </select>
            <div className="flex gap-3">
              <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 bg-surface-2 rounded-xl font-black text-sm">Cancel</button>
              <button disabled={create.isPending} className="px-4 py-2 bg-primary text-white rounded-xl font-black text-sm flex items-center gap-2">
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Start Broadcast
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="font-black text-lg flex items-center gap-2"><History className="h-5 w-5" /> Campaigns</h2>
        {campaigns?.map(c => {
          const progress = c.total_users > 0 ? ((c.sent_count + c.failed_count) / c.total_users) * 100 : 0;
          return (
            <div key={c.id} className="bg-surface-1 border p-5 rounded-2xl flex items-center gap-6">
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-black text-sm truncate">{c.text.slice(0, 50)}...</p>
                  <span className={cn(
                    "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                    c.status === "sending" ? "bg-amber-500/10 text-amber-500" :
                    c.status === "completed" ? "bg-emerald-500/10 text-emerald-500" :
                    "bg-slate-500/10 text-slate-500"
                  )}>{c.status}</span>
                </div>
                <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex gap-4 text-[10px] font-black text-muted-foreground uppercase">
                  <span>Sent: {c.sent_count}</span>
                  <span>Failed: {c.failed_count}</span>
                  <span>Pending: {Math.max(0, c.total_users - (c.sent_count + c.failed_count))}</span>
                  <span className="ml-auto">{progress.toFixed(1)}%</span>
                </div>
              </div>
              
              {c.status === "sending" && (
                <button onClick={() => adminUpdateCampaignStatus({ data: { campaignId: c.id, status: "paused" } })} className="p-3 bg-surface-2 hover:bg-surface-3 rounded-xl">
                  <Pause className="h-5 w-5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
