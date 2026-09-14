import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Shared server-side Supabase client type — import this instead of a loose `any`-based shape. */
export type Db = SupabaseClient<Database>;

/**
 * Server-side Supabase client.
 * Browser writes are revoked on every table, so the engine (sync, ingest
 * journal, prediction ledger, grading) must run with the service role.
 * Falls back to the publishable key for read-only environments.
 */
export function serverDb() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Backend is not configured.");

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
