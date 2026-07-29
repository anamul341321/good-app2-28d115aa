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

export async function buildUserCard(uidRaw: string): Promise<LookupResult> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

  const uid = uidRaw.trim();
  let profile: any = null;

  if (/^\d+$/.test(uid)) {
    const { data } = await db
      .from("profiles")
      .select("id, display_name, phone_number, uid_seq, referral_code, referred_by, banned, banned_reason, created_at")
      .eq("uid_seq", Number(uid))
      .maybeSingle();
    profile = data;
  }
  if (!profile) {
    const { data } = await db
      .from("profiles")
      .select("id, display_name, phone_number, uid_seq, referral_code, referred_by, banned, banned_reason, created_at")
      .eq("referral_code", uid.toUpperCase())
      .maybeSingle();
    profile = data;
  }
  if (!profile) return { found: false };

  // Settle mining so the balance shown is live.
  try { await db.rpc("settle_mining", { _user_id: profile.id }); } catch { /* ignore */ }

  const [tasksRes, miningRes, refsRes, wdRes, debtRes] = await Promise.all([
    db.from("tasks").select("slot, status, whitelist_ok, wallet_address, reverify_count").eq("user_id", profile.id),
    db.from("mining_state").select("accrued_amount, withdrawn_amount, bonus_amount, is_active, effective_task_count").eq("user_id", profile.id).maybeSingle(),
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

  const card =
    `👤 <b>${profile.display_name || "ইউজার"}</b> — UID <code>${profile.uid_seq ?? "—"}</code>\n` +
    `📱 ${mask(profile.phone_number)}   🔗 রেফার কোড: <code>${profile.referral_code}</code>\n` +
    (profile.banned ? `🚫 <b>একাউন্ট ব্যান</b> — ${profile.banned_reason || "কারণ নেই"}\n` : "") +
    `\n<b>✅ ফেস ভেরিফিকেশন</b>\n` +
    `   ১ম ভেরিফাই: <b>${firstVerified}/10</b>\n` +
    `   রি-ভেরিফাই: <b>${reVerified}/10</b>\n` +
    (notWhitelisted ? `   ⚠️ হোয়াইটলিস্ট বাতিল: <b>${notWhitelisted}</b> টি স্লট\n` : "") +
    `\n<b>👥 রেফার</b>\n` +
    `   মোট রেফার: <b>${referees.length}</b> জন\n` +
    `   তাদের মোট ১ম ফেস: <b>${refFirst}</b> টি\n` +
    `   ১০/১০ সম্পন্ন করেছে: <b>${refComplete}</b> জন\n` +
    (lines.length ? lines.join("\n") + "\n" : "") +
    `\n<b>💰 হিসাব</b>\n` +
    `   বর্তমান ব্যালেন্স: <b>${bdt(balance - debt)}</b>\n` +
    `   বোনাস: ${bdt(Number(mining?.bonus_amount ?? 0))}   মাইনিং: ${mining?.is_active ? "🟢 চালু" : "🔴 বন্ধ"}\n` +
    `   পেইড উইথড্র: <b>${bdt(paid)}</b>${pending ? `   পেন্ডিং: ${bdt(pending)}` : ""}\n` +
    (debt ? `   ⚠️ বকেয়া (ফেরতযোগ্য): <b>${bdt(debt)}</b>\n` : "");

  return { found: true, card };
}
