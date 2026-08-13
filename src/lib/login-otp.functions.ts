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
