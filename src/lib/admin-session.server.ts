import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

export type AdminSession = { unlocked?: boolean; at?: number };

export function getAdminSessionConfig() {
  const password = process.env.ADMIN_SESSION_SECRET;
  if (!password) throw new Error("ADMIN_SESSION_SECRET not set");
  return {
    password,
    name: "fm-admin",
    maxAge: 60 * 60 * 8, // 8 hours
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none" as const,
      path: "/",
    },
  };
}

export function hashPassword(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hashMatches(input: string, expectedHex: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  let b: Buffer;
  try { b = Buffer.from(expectedHex, "hex"); } catch { return false; }
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function requireAdminSession() {
  const session = await useSession<AdminSession>(getAdminSessionConfig());
  if (!session.data.unlocked) {
    throw new Error("ADMIN_LOCKED");
  }
  return session;
}
