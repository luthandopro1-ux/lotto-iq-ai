import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export type PricingContext = {
  countryCode: string;
  countrySource: "edge" | "fallback";
  baseCurrency: "ZAR";
  localizedConversionAvailable: false;
};

export type BetaStatus = {
  enabled: boolean;
  label: string;
  starts_at: string;
  ends_at: string;
  max_workspaces: number;
  registered_workspaces: number;
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

export const getBetaStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<BetaStatus | null> => {
    const { supabase } = await import("@/integrations/supabase/client");
    const db = supabase as unknown as {
      rpc: (
        name: "get_beta_status",
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data, error } = await db.rpc("get_beta_status");
    if (error) throw new Error(`Failed to load beta status: ${error.message}`);
    if (!data || typeof data !== "object") return null;
    const value = data as Record<string, unknown>;
    return {
      enabled: value["enabled"] === true,
      label: String(value["label"] ?? "100% Early Bird Beta"),
      starts_at: String(value["starts_at"] ?? ""),
      ends_at: String(value["ends_at"] ?? ""),
      max_workspaces: Number(value["max_workspaces"] ?? 1000),
      registered_workspaces: Number(value["registered_workspaces"] ?? 0),
    };
  },
);
