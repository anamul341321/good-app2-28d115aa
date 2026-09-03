import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { adminListCountries, adminUpdateCountry, adminAddCountry } from "@/lib/countries.functions";
import { Globe2, Save, Plus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/countries")({
  ssr: false,
  component: AdminCountries,
});

function AdminCountries() {
  const list = useServerFn(adminListCountries);
  const update = useServerFn(adminUpdateCountry);
  const add = useServerFn(adminAddCountry);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-countries"],
    queryFn: () => list(),
  });

  const save = useMutation({
    mutationFn: (v: {
      code: string;
      monthly_mining_bdt: number;
      referral_bonus_bdt: number;
      referral_bonus_active: boolean;
      signup_allowed: boolean;
    }) => update({ data: v }),
    onSuccess: () => {
      toast.success("সেভ হয়েছে");
      qc.invalidateQueries({ queryKey: ["admin-countries"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "সেভ হয়নি"),
  });

  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newFlag, setNewFlag] = useState("");
  const [newMining, setNewMining] = useState("400");
  const [newBonus, setNewBonus] = useState("150");
  const [newActive, setNewActive] = useState(true);

  const create = useMutation({
    mutationFn: () =>
      add({
        data: {
          code: newCode.trim().toUpperCase(),
          name_en: newName.trim(),
          flag: newFlag.trim() || "🌐",
          monthly_mining_bdt: Number(newMining) || 400,
          referral_bonus_bdt: Number(newBonus) || 0,
          referral_bonus_active: newActive,
        },
      }),
    onSuccess: () => {
      toast.success("দেশ যোগ হয়েছে");
      setNewCode("");
      setNewName("");
      qc.invalidateQueries({ queryKey: ["admin-countries"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "যোগ হয়নি"),
  });

  return (
    <div className="space-y-4">
      <div className="premium-panel rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-amber" />
          <h1 className="text-lg font-black text-amber">Country rates & referral bonus</h1>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          প্রতিটি দেশের monthly mining (১০ ঘর) এবং instant referral bonus এখান থেকেই control হয়। Bangladesh = 500
          (change korle user der rate change hobe).
        </p>
      </div>

      <div className="glass rounded-2xl p-4">
        <p className="text-xs font-black">নতুন দেশ যোগ / update</p>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-6">
          <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Code (e.g. PT)"
            className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs" />
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name"
            className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs" />
          <input value={newFlag} onChange={(e) => setNewFlag(e.target.value)} placeholder="🇵🇹"
            className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs" />
          <input value={newMining} onChange={(e) => setNewMining(e.target.value)} placeholder="Mining"
            className="mono-num rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs" />
          <input value={newBonus} onChange={(e) => setNewBonus(e.target.value)} placeholder="Bonus"
            className="mono-num rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs" />
          <label className="flex items-center gap-1 text-[11px] font-bold">
            <input type="checkbox" checked={newActive} onChange={(e) => setNewActive(e.target.checked)} />
            Bonus on
          </label>
        </div>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending || newCode.length < 2 || newName.length < 2}
          className="gradient-cta mt-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black disabled:opacity-50"
        >
          {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          যোগ করো
        </button>
      </div>

      {isLoading && (
        <div className="glass rounded-2xl p-6 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-amber" />
        </div>
      )}

      <div className="space-y-2">
        {(data ?? []).map((row) => (
          <CountryRow key={row.code} row={row} onSave={(v) => save.mutate(v)} saving={save.isPending} />
        ))}
      </div>
    </div>
  );
}

function CountryRow({
  row,
  onSave,
  saving,
}: {
  row: {
    code: string;
    name_en: string;
    flag: string;
    monthly_mining_bdt: number;
    referral_bonus_bdt: number;
    referral_bonus_active: boolean;
    signup_allowed: boolean;
  };
  onSave: (v: {
    code: string;
    monthly_mining_bdt: number;
    referral_bonus_bdt: number;
    referral_bonus_active: boolean;
    signup_allowed: boolean;
  }) => void;
  saving: boolean;
}) {
  const [mining, setMining] = useState(String(row.monthly_mining_bdt));
  const [bonus, setBonus] = useState(String(row.referral_bonus_bdt));
  const [active, setActive] = useState(row.referral_bonus_active);
  const [signup, setSignup] = useState(row.signup_allowed);

  const dirty =
    Number(mining) !== row.monthly_mining_bdt ||
    Number(bonus) !== row.referral_bonus_bdt ||
    active !== row.referral_bonus_active ||
    signup !== row.signup_allowed;

  return (
    <div
      className={`rounded-2xl border p-3 ${
        active ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-surface-2"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg">{row.flag}</span>
        <div className="min-w-[120px] flex-1">
          <p className="text-xs font-black">{row.name_en}</p>
          <p className="mono-num text-[10px] text-muted-foreground">{row.code}</p>
        </div>
        <label className="text-[10px] font-bold">
          Mining ৳
          <input value={mining} onChange={(e) => setMining(e.target.value)}
            className="mono-num ml-1 w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs" />
        </label>
        <label className="text-[10px] font-bold">
          Bonus ৳
          <input value={bonus} onChange={(e) => setBonus(e.target.value)}
            className="mono-num ml-1 w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs" />
        </label>
        <label className="flex items-center gap-1 text-[10px] font-bold">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Bonus on
        </label>
        <label className="flex items-center gap-1 text-[10px] font-bold">
          <input type="checkbox" checked={signup} onChange={(e) => setSignup(e.target.checked)} /> Signup
        </label>
        <button
          onClick={() =>
            onSave({
              code: row.code,
              monthly_mining_bdt: Number(mining) || 0,
              referral_bonus_bdt: Number(bonus) || 0,
              referral_bonus_active: active,
              signup_allowed: signup,
            })
          }
          disabled={!dirty || saving}
          className="gradient-cta inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-black disabled:opacity-40"
        >
          <Save className="h-3 w-3" /> Save
        </button>
      </div>
    </div>
  );
}
