import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSharedAuth } from "@/lib/auth-function-middleware";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  // Email/webhook/cron routes authenticate themselves — never wrap or redirect them.
  if (new URL(request.url).pathname.startsWith("/lovable/")) {
    return next();
  }
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  // A single local-first bearer attacher keeps protected calls independent
  // from Supabase's browser auth lock. Never stack the generated attacher
  // here: it calls getSession() again for every request and can block the app.
  functionMiddleware: [attachSharedAuth],
  requestMiddleware: [errorMiddleware],
}));
