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
      .order("id")
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
      .order("id")
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
  // Exclude uid_seq=1 (admin/test account) from all public feeds.
  const { data: excludeProfiles } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("uid_seq", [1]);
  const excludeIds = new Set((excludeProfiles ?? []).map((p: any) => p.id));

  // Recent paid withdrawals (most recent first) so the Paid tab shows fresh history,
  // not old high-amount ones.
  const { data: paidRaw } = await supabaseAdmin
    .from("withdrawals")
    .select("id, user_id, amount, provider, wallet_number, status, created_at, processed_at")
    .eq("status", "paid")
    .order("processed_at", { ascending: false, nullsFirst: false })
    .limit(200);
  // Pull ALL recent pending withdrawals so real users' pending requests
  // are always visible in the feed until admin marks them paid.
  const { data: pendingRaw } = await supabaseAdmin
    .from("withdrawals")
    .select("id, user_id, amount, provider, wallet_number, status, created_at, processed_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(200);
  const seen = new Set<string>();
  const wRows: any[] = [];
  for (const w of [...(pendingRaw ?? []), ...(paidRaw ?? [])]) {
    if (excludeIds.has((w as any).user_id)) continue;
    if (seen.has((w as any).id)) continue;
    seen.add((w as any).id);
    wRows.push(w);
    if (wRows.length >= 200) break;
  }

  // Full paid history for top-payees leaderboard — sum of paid amount per user.
  const paidByUser = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from("withdrawals")
      .select("user_id, amount")
      .eq("status", "paid")
      .order("id")
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const w of data as any[]) {
      if (excludeIds.has(w.user_id)) continue;
      paidByUser.set(w.user_id, (paidByUser.get(w.user_id) ?? 0) + Number(w.amount));
    }
    if (data.length < 1000) break;
  }
  const topPayeePairs = [...paidByUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

  const wUserIds = Array.from(new Set([
    ...(wRows ?? []).map((w: any) => w.user_id),
    ...topPayeePairs.map((p) => p[0]),
  ]));
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

  const topPayees = topPayeePairs.map(([id, total]) => {
    const p = wpmap.get(id);
    return {
      id,
      total: Number(total),
      name: (p?.display_name ?? "User").trim() || "User",
      uid: Number(p?.uid_seq ?? 0),
    };
  });

  // ============================================================
  // UI-ONLY fake population to make the app look busy on the public
  // dashboard. Admin panels do NOT call getLeaderboards; they read the
  // real tables directly, so accounting stays correct there.
  //
  // FREEZE RULE: while withdraw is switched OFF, the feed must stop moving —
  // no new pending, no new paid. Everything is generated against the moment
  // withdraw was turned off, so only the older rows keep showing.
  // ============================================================
  const { data: wSettings } = await supabaseAdmin
    .from("bonus_settings")
    .select("withdraw_enabled, withdraw_off_until, updated_at")
    .eq("id", "default")
    .maybeSingle();
  const offUntilMs = (wSettings as any)?.withdraw_off_until
    ? new Date((wSettings as any).withdraw_off_until).getTime()
    : null;
  const withdrawOff =
    (wSettings as any)?.withdraw_enabled === false &&
    (offUntilMs == null || offUntilMs > Date.now());
  const freezeAtMs = (wSettings as any)?.updated_at
    ? new Date((wSettings as any).updated_at).getTime()
    : Date.now();
  // Clock used for the synthetic feed: frozen at switch-off time when closed.
  const feedNow = withdrawOff ? freezeAtMs : Date.now();
  const dayKey = Math.floor(feedNow / (24 * 3600 * 1000));

  const seedRand = (seed: number) => {
    let s = seed | 0;
    return () => {
      s = (s * 1664525 + 1013904223) | 0;
      return ((s >>> 0) % 100000) / 100000;
    };
  };
  const rnd = seedRand(dayKey * 9301 + 49297);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

  const FAKE_NAMES = [
    // Bangla
    "সুজন আহমেদ","আকাশ হাসান","রাকিব হোসেন","শাকিল আহমেদ","তানভীর হাসান",
    "জুবায়ের রহমান","ইমরান খান","নাঈম ইসলাম","রিফাত হোসেন","সাব্বির আহমেদ",
    "মাহমুদ হাসান","আরিফ হোসেন","হাসিব খান","রায়হান আলি","মাহিন আহমেদ",
    "সোহাগ মিয়া","সাকিব হাসান","জনি ইসলাম","রুবেল আহমেদ","শান্ত হোসেন",
    "মেহেদী হাসান","ফাহিম রহমান","তাসিন আহমেদ","পারভেজ হোসেন","রাসেল খান",
    "নুরুল ইসলাম","জাহিদ হাসান","শামীম আহমেদ","আব্দুল্লাহ আল মামুন","হাবিব রহমান",
    "সিয়াম হাসান","তামিম ইকবাল","রনি আহমেদ","জাকির হোসেন","মিরাজ হাসান",
    "আশিক মাহমুদ","রোহান খান","ফরহাদ হোসেন","কামরুল ইসলাম","বাপ্পি আহমেদ",
    "মিলন হোসেন","শফিক আহমেদ","আলামিন খান","জসিম উদ্দিন","নাসির হাসান",
    "রফিক ইসলাম","তৌহিদ হাসান","রাজু আহমেদ","পলাশ হোসেন","বিপ্লব হাসান",
    // Banglish
    "Sujon Ahmed","Akash Hasan","Rakib Hossain","Shakil Ahmed","Tanvir Hasan",
    "Jubayer Rahman","Imran Khan","Naim Islam","Rifat Hossain","Sabbir Ahmed",
    "Mahmud Hasan","Arif Hossain","Hasib Khan","Rayhan Ali","Mahin Ahmed",
    "Sohag Mia","Sakib Hasan","Jony Islam","Rubel Ahmed","Shanto Hossain",
    "Mehedi Hasan","Fahim Rahman","Tasin Ahmed","Parvez Hossain","Rasel Khan",
    "Nurul Islam","Jahid Hasan","Shamim Ahmed","Abdullah Al Mamun","Habib Rahman",
    "Siam Hasan","Tamim Iqbal","Rony Ahmed","Zakir Hossain","Miraj Hasan",
    "Ashik Mahmud","Rohan Khan","Forhad Hossain","Kamrul Islam","Bappy Ahmed",
    "Milon Hossain","Shofik Ahmed","Alamin Khan","Josim Uddin","Nasir Hasan",
    "Rofik Islam","Touhid Hasan","Raju Ahmed","Polash Hossain","Biplob Hasan",
  ];
  const usedNames = new Set<string>();
  const uniqueName = () => {
    for (let i = 0; i < 20; i++) {
      const n = pick(FAKE_NAMES);
      if (!usedNames.has(n)) { usedNames.add(n); return n; }
    }
    return pick(FAKE_NAMES);
  };
  const fakeId = () => `fake-${Math.floor(rnd() * 1e12).toString(36)}`;
  const fakeUid = () => 10000 + Math.floor(rnd() * 89999);
  const providers: Array<"bkash" | "nagad" | "usdt"> = ["bkash", "nagad", "bkash", "nagad", "usdt"];
  const maskFakeNumber = (prov: string) => {
    if (prov === "usdt") return "0x" + Math.floor(rnd() * 1e8).toString(16).padStart(8, "0").slice(0, 4) + "•••••" + Math.floor(rnd() * 1e4).toString(16).padStart(4, "0");
    const p = pick(["017", "018", "019", "016", "015", "013", "014"]);
    return p + "•••••" + Math.floor(rnd() * 90 + 10);
  };

  // Fake referrers/verifiers (appended, then re-sorted)
  const fakeReferrers = Array.from({ length: 20 }, () => ({
    id: fakeId(), count: 40 + Math.floor(rnd() * 260),
    name: uniqueName(), uid: fakeUid(),
  }));
  const fakeVerified = Array.from({ length: 20 }, () => ({
    id: fakeId(), count: 30 + Math.floor(rnd() * 200),
    name: uniqueName(), uid: fakeUid(),
  }));

  // Fake top-payees — totals kept modest so nothing looks unrealistic.
  const fakePayees = Array.from({ length: 25 }, () => ({
    id: fakeId(), total: 800 + Math.floor(rnd() * 6000),
    name: uniqueName(), uid: fakeUid(),
  }));

  // Fake withdraw feed rows — highest amount stays under 1000৳.
  // Pending rows auto-flip to Paid after 5–8 minutes; rotate every minute
  // so fresh pending names keep appearing continuously.
  const nowMs = Date.now();
  const minuteBucket = Math.floor(nowMs / (60 * 1000));
  const rnd2 = seedRand(dayKey * 9301 + 49297 + minuteBucket);
  // Display-only amounts. These MUST match what a real user can actually
  // receive under the CURRENT offer + fee rules, otherwise the feed looks fake:
  //   re-verify bonus 300৳ gross → 10% fee → 270৳ payout
  //   refer bonus     70৳ gross  → 20% fee → 56৳  payout
  //   combos: 140→126, 63→50, 210→189, 350→315
  const COMMON_AMOUNTS = [270, 56, 270, 126, 56, 270, 50, 189, 56, 270, 315, 126];
  const fakeWithdraws: any[] = [];
  for (let i = 0; i < 80; i++) {
    const prov = pick(providers);
    // Pending lifespan per row: 5–8 minutes, then auto-paid.
    const pendingLifespanMs = (5 + Math.floor(rnd2() * 4)) * 60 * 1000;
    // Spread creation times: newest few rows within pending lifespan, rest older.
    const createdOffset = i < 8
      ? Math.floor(rnd2() * pendingLifespanMs)
      : Math.floor(rnd() * (24 * 3600 * 1000));
    const created = new Date(nowMs - createdOffset).toISOString();
    const isPending = createdOffset < pendingLifespanMs;
    const status = isPending ? "pending" : "paid";
    // Once lifespan passes, mark as paid at created + lifespan (auto-flip).
    const processed = status === "paid"
      ? new Date(nowMs - createdOffset + pendingLifespanMs).toISOString()
      : null;
    fakeWithdraws.push({
      id: fakeId(),
      user_id: fakeId(),
      name: uniqueName(),
      uid: fakeUid(),
      amount: pick(COMMON_AMOUNTS),
      provider: prov,
      wallet_masked: maskFakeNumber(prov),
      status,
      created_at: created,
      processed_at: processed,
    });
  }

  const realTopRef = build(topRefPairs);
  const realTopVer = build(topVerPairs);
  const mergedRefs = [...realTopRef, ...fakeReferrers].sort((a, b) => b.count - a.count).slice(0, 10);
  const mergedVers = [...realTopVer, ...fakeVerified].sort((a, b) => b.count - a.count).slice(0, 10);
  const mergedPayees = [...topPayees, ...fakePayees].sort((a, b) => b.total - a.total).slice(0, 20);
  const realPending = withdraws.filter((w) => w.status === "pending");
  const fakePending = fakeWithdraws.filter((w) => w.status === "pending");
  const allPaid = [...withdraws.filter((w) => w.status !== "pending"), ...fakeWithdraws.filter((w) => w.status !== "pending")]
    .sort((a, b) => {
      const at = new Date(a.processed_at ?? a.created_at).getTime();
      const bt = new Date(b.processed_at ?? b.created_at).getTime();
      return bt - at;
    });
  const mergedWithdraws = [
    ...realPending.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    ...fakePending.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    ...allPaid,
  ].slice(0, 200);

  return {
    topReferrers: mergedRefs,
    topVerified: mergedVers,
    topPayees: mergedPayees,
    withdraws: mergedWithdraws,
    avgWaitSeconds: avgWaitSeconds || 240,
  };
});
