import { createServerFn } from "@tanstack/react-start";

// Public leaderboards + public withdraw feed for the dashboard.
// - Top referrers: ranked by count of face-verifications made by their referred users
//   (i.e. "verifications coming from your network"), not raw referral signups.
// - Top verifiers: ranked by number of face-verifications the user made themselves.
// - Withdraw feed: all withdrawals across the app with wallet numbers masked so
//   only the user themselves can spot their own row (name + UID visible, number hidden).
export const getLeaderboards = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Paginated pull of (id, referred_by) so we can attribute each verification
  // back to the referrer that brought that user in.
  const profRows: Array<{ id: string; referred_by: string | null }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, referred_by")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    profRows.push(...((data ?? []) as any));
    if (!data || data.length < 1000) break;
  }
  const parentOf = new Map<string, string>();
  for (const p of profRows) {
    if (p.referred_by) parentOf.set(p.id, p.referred_by);
  }

  // Paginated pull of verified tasks — one row per verified slot.
  const verRows: Array<{ user_id: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("tasks")
      .select("user_id")
      .not("initial_verify_at", "is", null)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    verRows.push(...((data ?? []) as any));
    if (!data || data.length < 1000) break;
  }
  const verCount = new Map<string, number>();
  const netCount = new Map<string, number>();
  for (const t of verRows) {
    verCount.set(t.user_id, (verCount.get(t.user_id) ?? 0) + 1);
    const parent = parentOf.get(t.user_id);
    if (parent) netCount.set(parent, (netCount.get(parent) ?? 0) + 1);
  }

  const topRefPairs = [...netCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topVerPairs = [...verCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const ids = Array.from(new Set([...topRefPairs.map((p) => p[0]), ...topVerPairs.map((p) => p[0])]));
  let pmap = new Map<string, { display_name: string | null; uid_seq: number | null }>();
  if (ids.length > 0) {
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, uid_seq")
      .in("id", ids);
    pmap = new Map((profs ?? []).map((p: any) => [p.id, { display_name: p.display_name, uid_seq: p.uid_seq }]));
  }

  const build = (pairs: [string, number][]) =>
    pairs.map(([id, count]) => {
      const p = pmap.get(id);
      return {
        id,
        count,
        name: (p?.display_name ?? "User").trim() || "User",
        uid: Number(p?.uid_seq ?? 0),
      };
    });

  // Public withdraw feed — last 200 withdrawals, sorted by amount desc.
  const { data: wRows } = await supabaseAdmin
    .from("withdrawals")
    .select("id, user_id, amount, provider, wallet_number, status, created_at, processed_at")
    .order("amount", { ascending: false })
    .limit(200);

  const wUserIds = Array.from(new Set((wRows ?? []).map((w: any) => w.user_id)));
  let wpmap = new Map<string, { display_name: string | null; uid_seq: number | null }>();
  if (wUserIds.length > 0) {
    const { data: wp } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, uid_seq")
      .in("id", wUserIds);
    wpmap = new Map((wp ?? []).map((p: any) => [p.id, { display_name: p.display_name, uid_seq: p.uid_seq }]));
  }

  const maskNumber = (n: string) => {
    const s = String(n ?? "");
    if (s.startsWith("0x") && s.length > 8) return s.slice(0, 4) + "•••••" + s.slice(-4);
    if (s.length <= 4) return "•".repeat(s.length);
    return s.slice(0, 3) + "•".repeat(Math.max(3, s.length - 5)) + s.slice(-2);
  };

  let waitSum = 0;
  let waitN = 0;
  const withdraws = (wRows ?? []).map((w: any) => {
    const p = wpmap.get(w.user_id);
    if (w.status === "paid" && w.processed_at) {
      const ms = new Date(w.processed_at).getTime() - new Date(w.created_at).getTime();
      if (ms > 0) { waitSum += ms; waitN += 1; }
    }
    return {
      id: w.id,
      user_id: w.user_id,
      name: (p?.display_name ?? "User").trim() || "User",
      uid: Number(p?.uid_seq ?? 0),
      amount: Number(w.amount),
      provider: w.provider,
      wallet_masked: maskNumber(w.wallet_number),
      status: w.status,
      created_at: w.created_at,
      processed_at: w.processed_at,
    };
  });
  const avgWaitSeconds = waitN > 0 ? Math.round(waitSum / waitN / 1000) : 0;

  return {
    topReferrers: build(topRefPairs),
    topVerified: build(topVerPairs),
    withdraws,
    avgWaitSeconds,
  };
});
