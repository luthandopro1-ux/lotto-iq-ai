import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

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

export type EarlyBirdStatus = { limit: number; claimed: number; remaining: number };

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
    if (error || !data) return { limit: 1000, claimed: 0, remaining: 1000 };
    return data;
  },
);
