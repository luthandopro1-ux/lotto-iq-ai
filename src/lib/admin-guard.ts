import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Optional write-protection for server functions that mutate data or
 * spend paid API credits (strategies, draws, Russia draws/backtests,
 * analysis refresh, AI insights/import).
 *
 * Production is fail-closed: ADMIN_API_KEY must be configured and every
 * guarded call must include a matching
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
    throw new Error("Unauthorized: ADMIN_API_KEY is not configured.");
  }

  const request = getRequest();
  const provided = request?.headers.get("x-admin-key") ?? "";
  if (provided !== required) {
    throw new Error("Unauthorized: missing or incorrect admin key.");
  }
  return next();
});
