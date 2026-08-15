import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SendInput = z.object({
  target: z.string().trim().min(1, "UID বা ফোন নম্বর দিন"),
  amount: z.number().int().min(15, "সর্বনিম্ন ১৫৳"),
  note: z.string().max(200).optional().nullable(),
});

export const sendBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SendInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fee = Math.floor(data.amount * 0.1);
    const { data: res, error } = await supabaseAdmin.rpc("send_balance_transfer", {
      _sender: context.userId,
      _target: data.target,
      _amount: data.amount,
      _note: data.note ?? "",
    });
    if (error) throw new Error(error.message);
    const r = res as any;
    if (!r?.ok) throw new Error(r?.error ?? "পাঠানো যায়নি");

    // Notify admins (private chat + group with mention) about every transfer,
    // since transfer-funded withdrawals are the main abuse pattern.
    try {
      const { alertAdminGroup } = await import("./telegram-alert.server");
      const { data: sp } = await supabaseAdmin
        .from("profiles").select("uid_seq, display_name").eq("id", context.userId).maybeSingle();
      await alertAdminGroup(
        `🔄 <b>ব্যালেন্স ট্রান্সফার</b>\n` +
          `👤 প্রেরক: ${(sp as any)?.display_name ?? "User"} (UID ${(sp as any)?.uid_seq ?? "—"})\n` +
          `👥 প্রাপক: ${r?.receiver_name ?? "User"}\n` +
          `💸 ${data.amount}৳ · ফি ${fee}৳\n` +
          `⚠️ প্রাপক এই টাকা দিয়ে withdraw দিলে অবশ্যই যাচাই করুন।`,
      );
    } catch {
      // alerting must never break a valid transfer
    }

    return { ...r, fee };
  });


export const getMyTransfers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("transfers")
      .select("id, sender_id, receiver_id, amount, fee_amount, note, created_at, sender:profiles!transfers_sender_id_fkey(display_name, uid_seq, phone_number), receiver:profiles!transfers_receiver_id_fkey(display_name, uid_seq, phone_number)")
      .or(`sender_id.eq.${context.userId},receiver_id.eq.${context.userId}`)
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []).map((t: any) => ({
      ...t,
      direction: t.sender_id === context.userId ? "out" : "in",
    }));
  });

const LookupInput = z.object({ target: z.string().trim().min(1) });
export const lookupTransferTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LookupInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const t = data.target.trim();
    let row: any = null;
    if (/^\d+$/.test(t)) {
      const r = await supabaseAdmin.from("profiles").select("id, display_name, uid_seq, phone_number, kyc_verified, avatar_url").eq("uid_seq", Number(t)).maybeSingle();
      row = r.data;
    }
    if (!row) {
      const r = await supabaseAdmin.from("profiles").select("id, display_name, uid_seq, phone_number, kyc_verified, avatar_url").eq("phone_number", t).maybeSingle();
      row = r.data;
    }
    if (!row) return { found: false };
    if (row.id === context.userId) return { found: false, self: true };
    let avatarSigned: string | null = null;
    if (row.avatar_url) {
      const s = await supabaseAdmin.storage.from("avatars").createSignedUrl(row.avatar_url, 300);
      avatarSigned = s.data?.signedUrl ?? null;
    }
    return {
      found: true,
      user: {
        id: row.id,
        display_name: row.display_name,
        uid_seq: row.uid_seq,
        phone_number: row.phone_number,
        kyc_verified: row.kyc_verified,
        avatar_url: avatarSigned,
      },
    };
  });
