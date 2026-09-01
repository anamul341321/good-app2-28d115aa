import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const startLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    identifier: z.string().trim().min(3, "নম্বর অথবা Gmail দিন"),
    password: z.string().min(1, "পাসওয়ার্ড দিন"),
    deviceId: z.string().trim().max(64).optional(),
  }).parse(input))
  .handler(async ({ data }) => {
    const { startLoginOtpHandler } = await import("./login-otp.server");
    return startLoginOtpHandler(data);
  });

export const completeLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      identifier: z.string().trim().min(3),
      password: z.string().min(1),
      code: z.string().trim(),
      deviceId: z.string().trim().max(64).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { completeLoginOtpHandler } = await import("./login-otp.server");
    return completeLoginOtpHandler(data);
  });

/** Gmail রিসেটের পর — লগইন না করেই নতুন Gmail-এ কোড পাঠানো */
export const startNewEmailForLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      identifier: z.string().trim().min(3),
      password: z.string().min(1),
      email: z.string().trim().min(5),
      deviceId: z.string().trim().max(64).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { startNewEmailHandler } = await import("./login-otp.server");
    return startNewEmailHandler(data);
  });

/** কোড মিলিয়ে নতুন Gmail যুক্ত করে লগইন সম্পূর্ণ */
export const completeNewEmailForLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      identifier: z.string().trim().min(3),
      password: z.string().min(1),
      email: z.string().trim().min(5),
      code: z.string().trim(),
      deviceId: z.string().trim().max(64).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { completeNewEmailHandler } = await import("./login-otp.server");
    return completeNewEmailHandler(data);
  });
