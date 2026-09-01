// Server-only: build a rich "user account card" for the Telegram bot from a UID.
// Called when a group member sends their Good-App UID after reporting a problem.

function mask(n?: string | null) {
  if (!n) return "—";
  const d = n.replace(/\D/g, "");
  if (d.length < 6) return "•".repeat(d.length);
  return `${d.slice(0, 3)}${"•".repeat(Math.max(0, d.length - 5))}${d.slice(-2)}`;
}

function bdt(n: number) {
  return `${Math.round(n).toLocaleString("en-US")}৳`;
}

function dhaka(iso?: string | null) {
  if (!iso) return "তারিখ নেই";
  return new Date(iso).toLocaleString("bn-BD", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function daysAgo(iso?: string | null) {
  if (!iso) return "—";
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (days === 0) return "আজ";
  return `${days.toLocaleString("bn-BD")} দিন আগে`;
}

function durationLeftBn(targetMs: number) {
  const left = Math.max(0, targetMs - Date.now());
  const days = Math.floor(left / 86_400_000);
  const hours = Math.ceil((left % 86_400_000) / 3_600_000);
  if (days <= 0) return `${Math.max(1, hours).toLocaleString("bn-BD")} ঘণ্টা`;
  return `${days.toLocaleString("bn-BD")} দিন ${hours.toLocaleString("bn-BD")} ঘণ্টা`;
}

async function pagedIds(
  db: any,
  table: string,
  select: string,
  apply: (q: any) => any,
): Promise<any[]> {
  const out: any[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    let q = db.from(table).select(select).order("id").range(from, from + size - 1);
    q = apply(q);
    const { data } = await q;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

export type LookupResult = { found: false } | { found: true; card: string };

type ProfilePick = { id: string; display_name: string | null; uid_seq: number | null; referral_code?: string | null };

export type ReferralJoinResult =
  | { found: false }
  | { found: true; uid: string; card: string };

async function findProfilesForQuery(db: any, queryRaw: string): Promise<ProfilePick[]> {
  const query = queryRaw.trim();
  if (!query) return [];

  const digitsOnly = query.replace(/\D/g, "");
  if (digitsOnly.length >= 10) {
    const { data } = await db
      .from("profiles")
      .select("id, display_name, uid_seq, referral_code")
      .in("phone_number", phoneVariants(query))
      .limit(1);
    if (data?.length) return data as ProfilePick[];
  }

  if (/^\d+$/.test(query)) {
    const { data } = await db
      .from("profiles")
      .select("id, display_name, uid_seq, referral_code")
      .eq("uid_seq", Number(query))
      .maybeSingle();
    return data ? [data] : [];
  }


  if (/^[A-Za-z0-9]{6,10}$/.test(query)) {
    const { data } = await db
      .from("profiles")
      .select("id, display_name, uid_seq, referral_code")
      .eq("referral_code", query.toUpperCase())
      .maybeSingle();
    if (data) return [data];
  }

  const safe = query.replace(/[%_]/g, "").slice(0, 40);
  if (safe.length < 2) return [];
  const { data } = await db
    .from("profiles")
    .select("id, display_name, uid_seq, referral_code")
    .ilike("display_name", `%${safe}%`)
    .order("uid_seq", { ascending: true })
    .limit(6);
  return (data ?? []) as ProfilePick[];
}

/** ফোন নম্বরের সম্ভাব্য রূপগুলো (01..., 8801..., +8801...) */
function phoneVariants(raw: string): string[] {
  const d = raw.replace(/\D/g, "");
  const local = d.startsWith("880") ? d.slice(3) : d;
  const l = local.startsWith("0") ? local : `0${local}`;
  const bare = l.replace(/^0/, "");
  return Array.from(new Set([raw.trim(), d, l, bare, `88${l}`, `+88${l}`]));
}

export async function buildUserCard(uidRaw: string): Promise<LookupResult> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

  const uid = uidRaw.trim();
  const cols =
    "id, display_name, phone_number, uid_seq, referral_code, referred_by, banned, banned_reason, created_at, kyc_verified, telegram_user_id";

  let profile: any = null;

  // ফোন নম্বর দিয়ে খোঁজা (১০+ ডিজিট হলে সেটা UID নয়, নম্বর)
  const digits = uid.replace(/\D/g, "");
  if (digits.length >= 10) {
    const { data } = await db
      .from("profiles").select(cols)
      .in("phone_number", phoneVariants(uid))
      .limit(1);
    profile = data?.[0] ?? null;
  }

  if (!profile && /^\d+$/.test(uid)) {
    const { data } = await db
      .from("profiles").select(cols)
      .eq("uid_seq", Number(uid))
      .maybeSingle();
    profile = data;
  }
  if (!profile && /^[A-Za-z0-9]{4,12}$/.test(uid)) {
    const { data } = await db
      .from("profiles").select(cols)
      .eq("referral_code", uid.toUpperCase())
      .maybeSingle();
    profile = data;
  }
  if (!profile && !/^\d+$/.test(uid) && uid.length >= 3) {
    const { data } = await db
      .from("profiles").select(cols)
      .ilike("display_name", `%${uid.replace(/[%_]/g, "").slice(0, 40)}%`)
      .limit(1);
    profile = data?.[0] ?? null;
  }
  if (!profile) return { found: false };


  // Settle mining so the balance shown is live.
  try { await db.rpc("settle_mining", { _user_id: profile.id }); } catch { /* ignore */ }

  const [tasksRes, miningRes, refsRes, wdRes, debtRes] = await Promise.all([
    db.from("tasks").select("slot, status, whitelist_ok, wallet_address, reverify_count").eq("user_id", profile.id),
    db.from("mining_state").select("accrued_amount, withdrawn_amount, mining_withdrawn, bonus_amount, is_active, effective_task_count").eq("user_id", profile.id).maybeSingle(),
    db.from("profiles").select("id, display_name, uid_seq").eq("referred_by", profile.id).order("id"),
    db.from("withdrawals").select("amount, status").eq("user_id", profile.id),
    db.from("user_debts").select("amount").eq("user_id", profile.id).eq("status", "active"),
  ]);

  const tasks = tasksRes.data ?? [];
  const firstVerified = new Set(
    tasks.filter((t: any) => t.wallet_address && (t.status === "done" || t.status === "verified")).map((t: any) => t.slot),
  ).size;
  const reVerified = new Set(
    tasks.filter((t: any) => (t.reverify_count ?? 0) > 0).map((t: any) => t.slot),
  ).size;
  const notWhitelisted = tasks.filter((t: any) => t.wallet_address && t.whitelist_ok === false).length;

  const mining = miningRes.data as any;
  const balance =
    Number(mining?.accrued_amount ?? 0) - Number(mining?.withdrawn_amount ?? 0);
  const debt = (debtRes.data ?? []).reduce((s: number, d: any) => s + Number(d.amount || 0), 0);

  const wds = wdRes.data ?? [];
  const paid = wds.filter((w: any) => w.status === "paid").reduce((s: number, w: any) => s + Number(w.amount || 0), 0);
  const pending = wds.filter((w: any) => w.status === "pending").reduce((s: number, w: any) => s + Number(w.amount || 0), 0);

  // Referees + how many first-verifies each of them has.
  const referees = refsRes.data ?? [];
  let refFirst = 0;
  let refComplete = 0;
  const lines: string[] = [];
  if (referees.length) {
    const ids = referees.map((r: any) => r.id);
    const rows: any[] = [];
    for (let i = 0; i < ids.length; i += 150) {
      const chunk = ids.slice(i, i + 150);
      const part = await pagedIds(db, "tasks", "user_id, slot, status, wallet_address", (q: any) =>
        q.in("user_id", chunk),
      );
      rows.push(...part);
    }
    const perUser = new Map<string, Set<number>>();
    for (const t of rows) {
      if (!t.wallet_address) continue;
      if (t.status !== "done" && t.status !== "verified") continue;
      if (!perUser.has(t.user_id)) perUser.set(t.user_id, new Set());
      perUser.get(t.user_id)!.add(t.slot);
    }
    for (const r of referees) {
      const c = perUser.get(r.id)?.size ?? 0;
      refFirst += c;
      if (c >= 10) refComplete++;
    }
    const top = referees
      .map((r: any) => ({ ...r, c: perUser.get(r.id)?.size ?? 0 }))
      .sort((a: any, b: any) => b.c - a.c)
      .slice(0, 5);
    for (const t of top) {
      lines.push(`   • UID <code>${t.uid_seq ?? "—"}</code> — ${t.c}/10 ${t.c >= 10 ? "✅" : ""}`);
    }
  }

  // মেইন ব্যালেন্স = বোনাস/রেফার বোনাসের অংশ (যেকোনো সময় তোলা যায়);
  // বাকিটা মাইনিং ব্যালেন্স (আনলক হলে শুধু মাসের ১–৩ তারিখে তোলা যায়)।
  const { splitBalance } = await import("@/lib/mining");
  const netBalance = Math.max(0, balance - debt);
  const { main: mainPart, mining: miningPart } = splitBalance({
    balance: netBalance,
    bonusTotal: Number(mining?.bonus_amount ?? 0),
    withdrawn: Number(mining?.withdrawn_amount ?? 0),
    miningWithdrawn: Number(mining?.mining_withdrawn ?? 0),
  });

  const kycOk = !!profile.kyc_verified && !!profile.telegram_user_id;
  const card =
    `👤 <b>${profile.display_name || "ইউজার"}</b> — UID <code>${profile.uid_seq ?? "—"}</code>\n` +
    `📱 ${mask(profile.phone_number)}   🔗 রেফার কোড: <code>${profile.referral_code}</code>\n` +
    (kycOk
      ? `🔵 <b>KYC: ভেরিফাইড ✅</b> — উইথড্র চালু\n`
      : `🔴 <b>KYC: হয়নি (unverified)</b> — একাউন্ট ঠিকই আছে, তবে KYC ছাড়া <b>টাকা তোলা যাবে না</b>।\n` +
        `   👉 অ্যাপের হোম পেজে লাল <b>“KYC করুন”</b> বাটনে চাপ দিন → টেলিগ্রাম খুলবে → <b>START</b> চাপুন → KYC শেষ (১০ সেকেন্ডের কাজ) 💙\n`) +
    (profile.banned ? `🚫 <b>একাউন্ট ব্যান</b> — ${profile.banned_reason || "কারণ নেই"}\n` : "") +

    `\n<b>✅ ফেস ভেরিফিকেশন</b>\n` +
    `   ১ম ভেরিফাই: <b>${firstVerified}/10</b>\n` +
    `   রি-ভেরিফাই: <b>${reVerified}/10</b>\n` +
    (notWhitelisted ? `   🔁 রি-ভেরিফাই চাওয়া হয়েছে: <b>${notWhitelisted}</b> টি স্লটে — অ্যাপের রি-ভেরিফাই পেজ থেকে করে নিন\n` : "") +
    `\n<b>👥 রেফার</b>\n` +
    `   মোট রেফার: <b>${referees.length}</b> জন\n` +
    `   তাদের মোট ১ম ফেস: <b>${refFirst}</b> টি\n` +
    `   ১০/১০ সম্পন্ন করেছে: <b>${refComplete}</b> জন\n` +
    (lines.length ? lines.join("\n") + "\n" : "") +
    `\n<b>💰 হিসাব</b>\n` +
    `   বর্তমান ব্যালেন্স: <b>${bdt(balance - debt)}</b>\n` +
    `   💚 মেইন ব্যালেন্স (যেকোনো সময় তোলা যায়): <b>${bdt(mainPart)}</b>\n` +
    `   ⛏️ মাইনিং ব্যালেন্স (আনলক থাকলে শুধু ১–৩ তারিখে তোলা যায়): <b>${bdt(miningPart)}</b>   মাইনিং: ${mining?.is_active ? "🟢 চালু" : "🔴 বন্ধ"}\n` +
    `   পেইড উইথড্র: <b>${bdt(paid)}</b>${pending ? `   পেন্ডিং: ${bdt(pending)}` : ""}\n` +
    (debt ? `   ⚠️ বকেয়া (ফেরতযোগ্য): <b>${bdt(debt)}</b>\n` : "");

  return { found: true, card };
}

/**
 * "UID 72 কার রেফারে join হয়েছে?" — show the real referrer from profiles.referred_by.
 */
export async function buildReferralJoinReport(uidRaw: string): Promise<ReferralJoinResult> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

  const query = uidRaw.trim();
  const cols = "id, display_name, uid_seq, referral_code, referred_by, created_at";
  let profile: any = null;

  const digits = query.replace(/\D/g, "");
  if (digits.length >= 10) {
    const { data } = await db
      .from("profiles")
      .select(cols)
      .in("phone_number", phoneVariants(query))
      .limit(1);
    profile = data?.[0] ?? null;
  }

  if (!profile && /^\d+$/.test(query)) {
    const { data } = await db
      .from("profiles")
      .select(cols)
      .eq("uid_seq", Number(query))
      .maybeSingle();
    profile = data;
  }

  if (!profile && /^[A-Za-z0-9]{4,12}$/.test(query)) {
    const { data } = await db
      .from("profiles")
      .select(cols)
      .eq("referral_code", query.toUpperCase())
      .maybeSingle();
    profile = data;
  }

  if (!profile) return { found: false };

  let referrer: any = null;
  if (profile.referred_by) {
    const { data } = await db
      .from("profiles")
      .select("id, display_name, uid_seq, referral_code, created_at")
      .eq("id", profile.referred_by)
      .maybeSingle();
    referrer = data;
  }

  const card = referrer
    ? `🔗 <b>রেফার রিপোর্ট</b>\n\n` +
      `👤 <b>${profile.display_name || "ইউজার"}</b> — UID <code>${profile.uid_seq ?? "—"}</code>\n` +
      `✅ এই একাউন্টটি <b>${referrer.display_name || "ইউজার"}</b> এর রেফারে join করেছে।\n` +
      `🆔 রেফারারের UID: <code>${referrer.uid_seq ?? "—"}</code>\n` +
      `🔖 রেফার কোড: <code>${referrer.referral_code ?? "—"}</code>\n` +
      `📅 Join: ${dhaka(profile.created_at)}`
    : `🔗 <b>রেফার রিপোর্ট</b>\n\n` +
      `👤 <b>${profile.display_name || "ইউজার"}</b> — UID <code>${profile.uid_seq ?? "—"}</code>\n` +
      `ℹ️ এই একাউন্টে কোনো রেফারার পাওয়া যায়নি — সম্ভবত direct join করেছে।\n` +
      `📅 Join: ${dhaka(profile.created_at)}`;

  return { found: true, uid: String(profile.uid_seq ?? query), card };
}

export type VerificationDateKind = "first" | "reverify" | "all";

export type VerificationDateReport =
  | { found: false; ambiguous?: ProfilePick[] }
  | { found: true; uid: string; card: string };

export async function buildVerificationDateReport(
  queryRaw: string,
  kind: VerificationDateKind = "first",
): Promise<VerificationDateReport> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const matches = await findProfilesForQuery(db, queryRaw);
  if (matches.length !== 1) {
    return matches.length ? { found: false, ambiguous: matches } : { found: false };
  }

  const profile = matches[0];
  const { data } = await db
    .from("tasks")
    .select("slot, status, wallet_address, initial_verify_at, last_reverified_at, reverify_count")
    .eq("user_id", profile.id)
    .order("slot", { ascending: true });

  const tasks = data ?? [];
  const firstRows = tasks.filter((t: any) =>
    !!t.wallet_address && (!!t.initial_verify_at || t.status === "verified" || t.status === "done"),
  );
  const reRows = tasks.filter((t: any) => Number(t.reverify_count ?? 0) > 0 || !!t.last_reverified_at);

  const line = (t: any, type: "first" | "re") => {
    const iso = type === "first" ? t.initial_verify_at : t.last_reverified_at;
    const extra = type === "re" && Number(t.reverify_count ?? 0) > 1
      ? ` — ${Number(t.reverify_count).toLocaleString("bn-BD")} বার`
      : "";
    return `   • স্লট <b>${Number(t.slot).toLocaleString("bn-BD")}</b> — ${dhaka(iso)} (${daysAgo(iso)})${extra}`;
  };

  const showFirst = kind === "first" || kind === "all";
  const showRe = kind === "reverify" || kind === "all";
  const parts: string[] = [
    `🗓️ <b>ভেরিফিকেশন তারিখ রিপোর্ট</b>`,
    `👤 <b>${profile.display_name || "ইউজার"}</b> — UID <code>${profile.uid_seq ?? queryRaw}</code>`,
  ];

  if (showFirst) {
    parts.push(
      `\n✅ <b>১ম ফেস ভেরিফাই: ${firstRows.length.toLocaleString("bn-BD")} টি</b>`,
      firstRows.length ? firstRows.map((t: any) => line(t, "first")).join("\n") : "   এখনো কোনো ১ম ভেরিফাই তারিখ পাওয়া যায়নি।",
    );
  }

  if (showRe) {
    parts.push(
      `\n🔁 <b>রি-ভেরিফাই: ${reRows.length.toLocaleString("bn-BD")} টি</b>`,
      reRows.length ? reRows.map((t: any) => line(t, "re")).join("\n") : "   এখনো কোনো রি-ভেরিফাই তারিখ পাওয়া যায়নি।",
    );
  }

  return { found: true, uid: String(profile.uid_seq ?? queryRaw), card: parts.join("\n") };
}

export async function buildReverifyStatusReport(queryRaw: string): Promise<VerificationDateReport> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const matches = await findProfilesForQuery(db, queryRaw);
  if (matches.length !== 1) {
    return matches.length ? { found: false, ambiguous: matches } : { found: false };
  }

  const profile = matches[0];
  const { data } = await db
    .from("tasks")
    .select("slot, status, wallet_address, initial_verify_at, reverify_due_at, last_reverified_at, reverify_count, whitelist_ok")
    .eq("user_id", profile.id)
    .order("slot", { ascending: true });

  const tasks = data ?? [];
  const verified = tasks.filter((t: any) =>
    !!t.wallet_address && (!!t.initial_verify_at || t.status === "verified" || t.status === "done"),
  );
  const asked = verified.filter((t: any) => t.whitelist_ok === false);
  const reDone = verified.filter((t: any) => Number(t.reverify_count ?? 0) > 0 || !!t.last_reverified_at);

  const lines = verified.slice(0, 30).map((t: any) => {
    const slot = Number(t.slot).toLocaleString("bn-BD");
    const firstAt = dhaka(t.initial_verify_at);
    const reCount = Number(t.reverify_count ?? 0);
    if (t.whitelist_ok === false) {
      return `• স্লট <b>${slot}</b> — ১ম: ${firstAt} → 🔁 <b>রি-ভেরিফাই চাওয়া হয়েছে</b>`;
    }
    if (reCount > 0 || t.last_reverified_at) {
      return `• স্লট <b>${slot}</b> — ১ম: ${firstAt} → ✅ রি-ভেরিফাই হয়েছে (${dhaka(t.last_reverified_at)})`;
    }
    const base = t.reverify_due_at || (t.initial_verify_at
      ? new Date(new Date(t.initial_verify_at).getTime() + 4 * 86_400_000).toISOString()
      : null);
    if (base && new Date(base).getTime() > Date.now()) {
      return `• স্লট <b>${slot}</b> — ১ম: ${firstAt} → ⏳ আনুমানিক ${durationLeftBn(new Date(base).getTime())} বাকি`;
    }
    return `• স্লট <b>${slot}</b> — ১ম: ${firstAt} → এখনো রি-ভেরিফাই সিগন্যাল আসেনি`;
  });

  const card =
    `🗓️ <b>রি-ভেরিফাই স্ট্যাটাস রিপোর্ট</b>\n` +
    `👤 <b>${profile.display_name || "ইউজার"}</b> — UID <code>${profile.uid_seq ?? queryRaw}</code>\n\n` +
    `✅ ১ম ভেরিফাই: <b>${verified.length.toLocaleString("bn-BD")}</b> টি\n` +
    `🔁 রি-ভেরিফাই চাওয়া হয়েছে: <b>${asked.length.toLocaleString("bn-BD")}</b> টি\n` +
    `✅ রি-ভেরিফাই সম্পন্ন: <b>${reDone.length.toLocaleString("bn-BD")}</b> টি\n\n` +
    (lines.length ? lines.join("\n") : "এখনো কোনো ১ম ভেরিফাই স্লট পাওয়া যায়নি।") +
    `\n\n<b>নোট:</b> ১ম ভেরিফাই করার পর সাধারণত ৪ দিনের কাউন্টডাউন/সিস্টেম সিগন্যাল অনুযায়ী রি-ভেরিফাই আসে। ৩ দিন হলে অনেক সময় এখনো সময় হয় না।`;

  return { found: true, uid: String(profile.uid_seq ?? queryRaw), card };
}

/**
 * "আমি রেফার করেছি কিন্তু রেফার বাড়ে না" — show the real referral history and
 * explain why the counted number can drop (a friend's slot needs re-verify) and
 * come back once they re-verify.
 */
export async function buildReferralHistoryReport(uidRaw: string): Promise<ReferralJoinResult> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

  const matches = await findProfilesForQuery(db, uidRaw.trim());
  if (matches.length !== 1) return { found: false };
  const profile = matches[0];

  const { data: referees } = await db
    .from("profiles")
    .select("id, display_name, uid_seq, created_at")
    .eq("referred_by", profile.id)
    .order("created_at", { ascending: true });

  const list = referees ?? [];
  const ids = list.map((r: any) => r.id);
  const rows: any[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const part = await pagedIds(db, "tasks", "user_id, slot, status, wallet_address, whitelist_ok", (q: any) =>
      q.in("user_id", chunk),
    );
    rows.push(...part);
  }

  const okSlots = new Map<string, Set<number>>();
  const pendingSlots = new Map<string, Set<number>>();
  for (const t of rows) {
    if (!t.wallet_address) continue;
    if (t.status !== "done" && t.status !== "verified") continue;
    const bucket = t.whitelist_ok === false ? pendingSlots : okSlots;
    if (!bucket.has(t.user_id)) bucket.set(t.user_id, new Set());
    bucket.get(t.user_id)!.add(t.slot);
  }

  let counted = 0;
  let waiting = 0;
  const lines: string[] = [];
  for (const r of list) {
    const ok = okSlots.get(r.id)?.size ?? 0;
    const pend = pendingSlots.get(r.id)?.size ?? 0;
    if (ok >= 10) counted++;
    else if (ok + pend >= 10) waiting++;
    lines.push(
      `   • <b>${r.display_name || "ইউজার"}</b> — UID <code>${r.uid_seq ?? "—"}</code> · ${ok}/10 ` +
        (ok >= 10 ? "✅ গণনায় আছে" : pend ? `⏳ ${pend} টি স্লটে রি-ভেরিফাই বাকি` : "🕒 ফেস বাকি"),
    );
  }

  const card =
    `👥 <b>রেফার হিস্টরি</b> — <b>${profile.display_name || "ইউজার"}</b> (UID <code>${profile.uid_seq ?? "—"}</code>)\n\n` +
    `মোট রেফার: <b>${list.length}</b> জন\n` +
    `গণনায় আছে (১০/১০ ঠিক আছে): <b>${counted}</b> জন\n` +
    (waiting ? `রি-ভেরিফাইয়ের অপেক্ষায়: <b>${waiting}</b> জন\n` : "") +
    (lines.length ? `\n${lines.slice(0, 15).join("\n")}\n` + (lines.length > 15 ? `   … আরও ${lines.length - 15} জন\n` : "") : "\nএখনো কেউ আপনার রেফারে join করেনি।\n") +
    `\n📌 <b>রেফার সংখ্যা কমে যায় কেন?</b>\n` +
    `আপনার কোনো বন্ধুর স্লটে যখন <b>রি-ভেরিফাই</b> চাওয়া হয়, তখন ওই স্লটটি সাময়িকভাবে গণনার বাইরে চলে যায় — তাই আপনার রেফার হিসাবও কমে দেখায়।\n` +
    `✅ সে আবার রি-ভেরিফাই সম্পন্ন করলেই স্লটটি আবার যোগ হয়ে যাবে এবং আপনার হিসাবও আগের মতো বেড়ে যাবে 💙`;

  return { found: true, uid: String(profile.uid_seq ?? uidRaw), card };
}
