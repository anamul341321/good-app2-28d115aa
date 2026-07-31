import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminActiveMiningUsers } from "@/lib/admin.functions";
import { Loader2, Pickaxe, Search, Users, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/admin/mining")({ component: AdminMining });

function AdminMining() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-active-mining"],
    queryFn: () => adminActiveMiningUsers(),
    refetchInterval: 60_000,
  });
  const [q, setQ] = useState("");

  const users = useMemo(() => {
    const list = data?.users ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((u: any) =>
      String(u.uid).includes(term) ||
      u.name.toLowerCase().includes(term) ||
      (u.phone ?? "").includes(term),
    );
  }, [data, q]);

  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>;

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 flex items-center gap-1.5">
          <Pickaxe className="w-3.5 h-3.5 text-cyan" /> Mining চালু আছে
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="mono-num font-black text-2xl text-cyan">{data?.total ?? 0}</p>
            <p className="text-[9px] text-muted-foreground font-bold">Active users</p>
          </div>
          <div>
            <p className="mono-num font-black text-2xl text-emerald">{(data?.monthlyTotal ?? 0).toFixed(0)}৳</p>
            <p className="text-[9px] text-muted-foreground font-bold">মাসিক মোট রেট</p>
          </div>
          <div>
            <p className="mono-num font-black text-2xl text-amber">{data?.forcedCount ?? 0}</p>
            <p className="text-[9px] text-muted-foreground font-bold">Admin forced</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          💡 যাদের ১০টি স্লট রি-ভেরিফাই সম্পন্ন, admin switch দিয়ে চালু করা, অথবা শুধু রেফার কমিশন চলছে — সবাই এখানে আছে
          {(data?.refOnlyCount ?? 0) > 0 ? ` (শুধু রেফার কমিশন: ${data?.refOnlyCount})` : ""}।
        </p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="নাম / UID / ফোন দিয়ে খুঁজুন"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface-2 border border-border text-xs font-bold outline-none focus:border-cyan"
        />
      </div>

      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-1">
        দেখাচ্ছে {users.length} জন
      </p>

      {users.map((u: any) => (
        <Link
          key={u.userId}
          to="/admin/user/$userId"
          params={{ userId: u.userId }}
          className="block glass rounded-xl p-3 hover:border-cyan transition"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-black truncate flex items-center gap-1.5">
                {u.name}
                {u.forced && <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber/20 text-amber font-black">FORCED</span>}
                {u.banned && <ShieldAlert className="w-3 h-3 text-rose" />}
              </p>
              <p className="text-[10px] text-muted-foreground mono-num truncate">UID {u.uid} · {u.phone}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="mono-num font-black text-sm text-emerald">{u.monthly.toFixed(0)}৳<span className="text-[9px] text-muted-foreground">/মাস</span></p>
              <p className="text-[9px] text-muted-foreground mono-num">জমা {u.accrued.toFixed(2)}৳</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-cyan/15 text-cyan mono-num">স্লট {u.slots}/10</span>
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-violet/15 text-violet mono-num flex items-center gap-1">
              <Users className="w-3 h-3" /> রেফার {u.refs}
            </span>
            {u.referralAccrued > 0 && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald/15 text-emerald mono-num">
                কমিশন {u.referralAccrued.toFixed(2)}৳
              </span>
            )}
          </div>
        </Link>
      ))}

      {users.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-10">কোনো user পাওয়া যায়নি</p>
      )}
    </div>
  );
}
