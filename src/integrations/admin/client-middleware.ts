import { createMiddleware } from "@tanstack/react-start";

const STORAGE_KEY = "lottoiq_admin_key";

export function getStoredAdminKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setStoredAdminKey(value: string) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, value);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private browsing etc.) — the key just won't persist.
  }
}

/**
 * Attaches the operator's admin key (see src/lib/admin-guard.ts) to every
 * server function call. Harmless no-op if ADMIN_API_KEY isn't set on the
 * server, or if the person hasn't saved a key locally yet.
 */
export const attachAdminKey = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const key = getStoredAdminKey();
  return next({ headers: key ? { "x-admin-key": key } : {} });
});
