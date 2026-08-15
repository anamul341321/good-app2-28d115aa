import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const adminScanCardImage = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ image: z.string().startsWith("data:image/").max(8_000_000) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("@/lib/admin-session.server");
    await requireAdminSession();
    const { extractCardCodes } = await import("@/lib/card-scan.server");
    const codes = await extractCardCodes(data.image);
    return { codes };
  });
