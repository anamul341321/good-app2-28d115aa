import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ password: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { useSession } = await import("@tanstack/react-start/server");
    const { getAdminSessionConfig, passwordMatches, hashMatches } = await import("@/lib/admin-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // DB-stored password takes precedence, then env fallback.
    let ok = false;
    const { data: row } = await supabaseAdmin
      .from("admin_settings").select("password_hash").eq("id", "default").maybeSingle();
    if (row?.password_hash) {
      ok = hashMatches(data.password, row.password_hash);
    } else {
      const expected = process.env.ADMIN_PASSWORD;
      if (expected) ok = passwordMatches(data.password, expected);
    }
    if (!ok) return { ok: false as const };

    const session = await useSession(getAdminSessionConfig());
    await session.update({ unlocked: true, at: Date.now() });
    return { ok: true as const };
  });

export const adminChangePassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ current: z.string().min(1), next: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { useSession } = await import("@tanstack/react-start/server");
    const { getAdminSessionConfig, passwordMatches, hashMatches, hashPassword } =
      await import("@/lib/admin-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Must already be unlocked (session cookie) to rotate the password.
    const session = await useSession<{ unlocked?: boolean }>(getAdminSessionConfig());
    if (!session.data.unlocked) throw new Error("Admin lock");

    // Verify current password.
    const { data: row } = await supabaseAdmin
      .from("admin_settings").select("password_hash").eq("id", "default").maybeSingle();
    let ok = false;
    if (row?.password_hash) ok = hashMatches(data.current, row.password_hash);
    else {
      const expected = process.env.ADMIN_PASSWORD;
      if (expected) ok = passwordMatches(data.current, expected);
    }
    if (!ok) return { ok: false as const, error: "Current password bhul" };

    const nextHash = hashPassword(data.next);
    const { error } = await supabaseAdmin
      .from("admin_settings")
      .upsert({ id: "default", password_hash: nextHash, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { useSession } = await import("@tanstack/react-start/server");
  const { getAdminSessionConfig } = await import("@/lib/admin-session.server");
  const session = await useSession(getAdminSessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const adminCheck = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { useSession } = await import("@tanstack/react-start/server");
    const { getAdminSessionConfig } = await import("@/lib/admin-session.server");
    const session = await useSession<{ unlocked?: boolean }>(getAdminSessionConfig());
    return { unlocked: !!session.data.unlocked };
  } catch {
    return { unlocked: false };
  }
});
