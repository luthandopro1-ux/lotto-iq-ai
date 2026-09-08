import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Optional write-protection for server functions that mutate data or
 * spend paid API credits (strategies, draws, Russia draws/backtests,
 * analysis refresh, AI insights/import).
 *
 * Off by default so existing deployments keep working exactly as
 * before. Set ADMIN_API_KEY as a Cloudflare secret to turn it on:
 * once set, every guarded call must include a matching
 * `x-admin-key` header or it's rejected with 401. The app's own
 * browser UI attaches this automatically once you save the same key
 * under Settings → Admin key (stored in localStorage, never sent
 * anywhere except this app's own server functions).
 *
 * This is deliberately a lightweight shared-secret gate, not a full
 * user-account system — there are no user accounts in this app. It
 * exists to stop a stranger who finds the URL from writing bogus
 * draws/strategies or draining your AI credits, not to support
 * multiple distinct logged-in users.
 */
export const adminGuard = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const required = process.env["ADMIN_API_KEY"];
  if (!required) {
    // Not configured — behave exactly as before (open). Recommended to
    // set this before exposing the deployment publicly; see DEPLOY.md.
    return next();
  }

  const request = getRequest();
  const provided = request?.headers.get("x-admin-key") ?? "";
  if (provided !== required) {
    throw new Error("Unauthorized: missing or incorrect admin key.");
  }
  return next();
});
