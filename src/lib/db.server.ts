import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Shared server-side Supabase client type — import this instead of a loose `any`-based shape. */
export type Db = SupabaseClient<Database>;

/**
 * Server-side Supabase client.
 * Browser writes are revoked on every table, so the engine (sync, ingest
 * journal, prediction ledger, grading) must run with the service role.
 * Falls back to the publishable key for read-only environments — but
 * that fallback is silent by default, which is exactly wrong for a
 * write-critical caller: if SUPABASE_SERVICE_ROLE_KEY isn't actually
 * set, a caller silently degrades to the anon-equivalent key, subject
 * to every RLS policy (e.g. `strategies` being administrator-only
 * reads since 20260919211000_private_strategy_visibility.sql) instead
 * of failing loudly. Pass requireServiceRole: true for any caller that
 * cannot function correctly on a degraded key — it throws immediately
 * instead of returning a client that will silently see empty results.
 */
export function serverDb(requireServiceRole = false) {
  const url = process.env["SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const key = serviceRoleKey || process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Backend is not configured.");
  if (requireServiceRole && !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured — refusing to run with a degraded key that would silently be subject to RLS.",
    );
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}
