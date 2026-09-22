import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireAccessContext } from "@/lib/authorization.server";

export type PricingContext = {
  countryCode: string;
  countrySource: "edge" | "fallback";
  baseCurrency: "ZAR";
  localizedConversionAvailable: false;
};

export const getPricingContext = createServerFn({ method: "GET" }).handler(
  async (): Promise<PricingContext> => {
    const request = getRequest();
    const edgeCountry =
      request?.headers.get("cf-ipcountry") ?? request?.headers.get("x-country-code");
    const countryCode =
      edgeCountry && /^[A-Z]{2}$/i.test(edgeCountry) ? edgeCountry.toUpperCase() : "ZA";
    return {
      countryCode,
      countrySource: edgeCountry ? "edge" : "fallback",
      baseCurrency: "ZAR",
      localizedConversionAvailable: false,
    };
  },
);

export type EarlyBirdStatus = {
  limit: number;
  claimed: number;
  remaining: number;
  enabled?: boolean;
  ends_at?: string;
};

type CountryCaptureDb = {
  rpc: (
    fn: "record_my_country_code",
    args: { p_country_code: string },
  ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
};

/** Stores only the edge-provided ISO country code on the caller's own workspace. */
export const captureWorkspaceCountry = createServerFn({ method: "POST" })
  .middleware([requireAccessContext])
  .handler(async ({ context }): Promise<void> => {
    const request = getRequest();
    const edgeCountry =
      request?.headers.get("cf-ipcountry") ?? request?.headers.get("x-country-code");
    const countryCode =
      edgeCountry && /^[A-Z]{2}$/i.test(edgeCountry) ? edgeCountry.toUpperCase() : "ZA";
    const db = context.supabase as unknown as CountryCaptureDb;
    const { error } = await db.rpc("record_my_country_code", { p_country_code: countryCode });
    if (error) throw new Error(`Could not record country metadata: ${error.message}`);
  });

type PremiumInterestDb = {
  rpc: (fn: "register_premium_beta_interest") => Promise<{
    data: { registered?: boolean; created_at?: string } | null;
    error: { message: string } | null;
  }>;
};

/** Records one authenticated user's interest without exposing the waitlist to clients. */
export const registerPremiumBetaInterest = createServerFn({ method: "POST" })
  .middleware([requireAccessContext])
  .handler(async ({ context }): Promise<{ registered: boolean; createdAt: string | null }> => {
    const db = context.supabase as unknown as PremiumInterestDb;
    const { data, error } = await db.rpc("register_premium_beta_interest");
    if (error) throw new Error(`Could not join the Premium waitlist: ${error.message}`);
    return { registered: data?.registered === true, createdAt: data?.created_at ?? null };
  });
// Narrow RPC surface for get_early_bird_status -- not in the generated
// Supabase types (predates this migration, same reason authorization.server.ts
// and daily.server.ts declare their own narrow types for their RPCs).
type EarlyBirdStatusDb = {
  rpc: (
    fn: "get_early_bird_status",
  ) => Promise<{ data: EarlyBirdStatus | null; error: { message: string } | null }>;
};

/** Public: how many early-bird Premium slots remain, out of 1,000. No auth required. */
export const getEarlyBirdStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<EarlyBirdStatus> => {
    const { serverDb } = await import("@/lib/db.server");
    const db = serverDb() as unknown as EarlyBirdStatusDb;
    const { data, error } = await db.rpc("get_early_bird_status");
    if (error || !data) return { limit: 1000, claimed: 0, remaining: 1000, enabled: false };
    return data;
  },
);
