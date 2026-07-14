import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminGetBonusSettings, adminUpdateBonusSettings } from "@/lib/admin.functions";
import { Gift, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/bonus-settings")({ component: BonusSettings });

function BonusSettings() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-bonus-settings"],
    queryFn: () => adminGetBonusSettings(),
  });

  const [fv, setFv] = useState("");
  const [rv, setRv] = useState("");
  const [rf, setRf] = useState("");

  useEffect(() => {
    if (!data) return;
    setFv(String((data as any).first_verify_bonus ?? 50));
    setRv(String((data as any).reverify_bonus ?? 200));
    setRf(String((data as any).referrer_bonus ?? 100));
  }, [data]);

  const save = useMutation({
    mutationFn: () => adminUpdateBonusSettings({
      data: {
        first_verify_bonus: Number(fv),
        reverify_bonus: Number(rv),
        referrer_bonus: Number(rf),
      },
    }),
    onSuccess: () => { toast.success("✅ বোনাস সেটিংস সেভ হয়েছে"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-amber" /></div>;

  const total = (Number(fv) || 0) + (Number(rv) || 0) + (Number(rf) || 0);

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="w-5 h-5 text-amber" />
          <h1 className="text-base font-black text-amber">Bonus Offer Settings</h1>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          এখানে বোনাস টাকার অংক পরিবর্তন করলে সব নতুন ইউজারের জন্য সাথে সাথে চালু হয়ে যাবে।
          যারা আগে বোনাস পেয়ে গেছে তারা আর দ্বিতীয়বার পাবে না — নতুনরা এই নতুন অংক পাবে।
        </p>
      </div>

      <div className="glass rounded-2xl p-4 space-y-3">
        <Field
          label="১) First-verify বোনাস (ইউজারের নিজের)"
          hint="১০ জন first verify complete হলে ইউজার নিজে এই টাকা পাবে (default 50৳)"
          value={fv} onChange={setFv} color="cyan" />
        <Field
          label="২) Re-verify বোনাস (ইউজারের নিজের)"
          hint="১০ জন re-verify complete + mining চালু (default 200৳)"
          value={rv} onChange={setRv} color="amber" />
        <Field
          label="৩) Referrer বোনাস"
          hint="যাকে refer করা হয়েছে সে ১০ first verify complete করলে referrer এই টাকা পাবে (default 100৳)"
          value={rf} onChange={setRf} color="violet" />

        <div className="rounded-xl bg-gradient-to-r from-amber/20 to-rose/20 border border-amber/40 p-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-amber">Total banner amount</p>
          <p className="text-2xl font-black text-navy mono-num">{total}৳</p>
          <p className="text-[10px] text-muted-foreground mt-1">Home banner এ এই টাকা দেখাবে</p>
        </div>

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="w-full py-3 rounded-xl gradient-cta text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, value, onChange, color }: {
  label: string; hint: string; value: string; onChange: (v: string) => void; color: "cyan" | "amber" | "violet";
}) {
  return (
    <div className={`rounded-xl border-2 p-3 border-${color}/40 bg-${color}/5`}>
      <label className={`text-[11px] font-black text-${color} block`}>{label}</label>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{hint}</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-lg font-black mono-num outline-none focus:border-amber"
        />
        <span className="text-xl font-black text-muted-foreground">৳</span>
      </div>
    </div>
  );
}
