import { createServerFn } from "@tanstack/react-start";

/** পাবলিক: Gmail কোড সিস্টেম চালু আছে কি না (login পেজ/গেট এটা দেখে UI বদলায়) */
export const getAuthMode = createServerFn({ method: "GET" }).handler(async () => {
  const { isEmailOtpEnabled } = await import("./auth-mode.server");
  return { emailOtpEnabled: await isEmailOtpEnabled() };
});
