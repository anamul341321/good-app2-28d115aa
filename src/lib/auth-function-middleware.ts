import { createMiddleware } from "@tanstack/react-start";
import { getSharedSession } from "@/lib/auth-session";

export const attachSharedAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await getSharedSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);