import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getBalanceAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    
    const { data: ledger, error } = await supabase
      .from("balance_ledger" as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);
    return ledger;
  });

export const getBalanceBreakdown = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    // Use maybeSingle or raw select because the RPC name is registered in the database
    // but the generated types might not have caught up yet.
    const { data, error } = await supabaseAdmin.rpc("get_user_balance_breakdown" as any, {
      _user_id: userId
    });

    if (error) throw new Error(error.message);
    return data;
  });
