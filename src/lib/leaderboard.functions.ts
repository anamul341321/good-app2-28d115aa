import { createServerFn } from "@tanstack/react-start";

// Public leaderboards for dashboard — top referrers and top face-verifiers.
// Names are shown lightly masked for privacy; ranking by count.
export const getLeaderboards = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1) Top referrers — count profiles by referred_by (paginate for >1000).
  const refRows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("referred_by")
      .not("referred_by", "is", null)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    refRows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const refCount = new Map<string, number>();
  for (const r of refRows) {
    refCount.set(r.referred_by, (refCount.get(r.referred_by) ?? 0) + 1);
  }
  const topRefPairs = [...refCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // 2) Top verified — count tasks with an initial_verify_at (paginated).
  const verRows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("tasks")
      .select("user_id")
      .not("initial_verify_at", "is", null)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    verRows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const verCount = new Map<string, number>();
  for (const t of verRows) {
    verCount.set(t.user_id, (verCount.get(t.user_id) ?? 0) + 1);
  }
  const topVerPairs = [...verCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const ids = Array.from(new Set([...topRefPairs.map((p) => p[0]), ...topVerPairs.map((p) => p[0])]));
  let pmap = new Map<string, { display_name: string | null; uid_seq: number | null }>();
  if (ids.length > 0) {
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, uid_seq")
      .in("id", ids);
    pmap = new Map((profs ?? []).map((p: any) => [p.id, { display_name: p.display_name, uid_seq: p.uid_seq }]));
  }

  const mask = (name: string) => {
    const n = (name || "User").trim();
    if (n.length <= 2) return n + "•";
    if (n.length <= 4) return n[0] + "•".repeat(Math.max(1, n.length - 2)) + n[n.length - 1];
    return n.slice(0, 2) + "•".repeat(3) + n.slice(-2);
  };

  const build = (pairs: [string, number][]) =>
    pairs.map(([id, count]) => {
      const p = pmap.get(id);
      return {
        id,
        count,
        name: mask(p?.display_name ?? "User"),
        uid: Number(p?.uid_seq ?? 0),
      };
    });

  return {
    topReferrers: build(topRefPairs),
    topVerified: build(topVerPairs),
  };
});
