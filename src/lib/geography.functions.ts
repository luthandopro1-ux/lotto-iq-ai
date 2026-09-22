import { createServerFn } from "@tanstack/react-start";
import { requireAccessContext } from "@/lib/authorization.server";

export type GeographyAnalytics = {
  totalWorkspaces: number;
  countries: Array<{
    countryCode: string;
    workspaces: number;
    activePremium: number;
  }>;
  unknownCountryWorkspaces: number;
};

type GeographyDb = {
  from: (table: "workspace_entitlements") => {
    select: (columns: "country_code,plan_code,status") => {
      then: (
        resolve: (result: {
          data: Array<{ country_code: string | null; plan_code: string; status: string }> | null;
          error: { message: string } | null;
        }) => void,
      ) => void;
    };
  };
};

export const getGeographyAnalytics = createServerFn({ method: "GET" })
  .middleware([requireAccessContext])
  .handler(async ({ context }): Promise<GeographyAnalytics> => {
    if (context.accessContext.role !== "administrator") {
      throw new Error("Administrator access required.");
    }

    const db = context.supabase as unknown as GeographyDb;
    const result = await new Promise<{
      data: Array<{ country_code: string | null; plan_code: string; status: string }> | null;
      error: { message: string } | null;
    }>((resolve) => {
      db.from("workspace_entitlements").select("country_code,plan_code,status").then(resolve);
    });
    if (result.error)
      throw new Error(`Failed to load geography analytics: ${result.error.message}`);

    const rows = result.data ?? [];
    const grouped = new Map<string, { workspaces: number; activePremium: number }>();
    let unknownCountryWorkspaces = 0;
    for (const row of rows) {
      const countryCode = row.country_code?.trim().toUpperCase() || "ZZ";
      if (countryCode === "ZZ") unknownCountryWorkspaces += 1;
      const current = grouped.get(countryCode) ?? { workspaces: 0, activePremium: 0 };
      current.workspaces += 1;
      if (row.plan_code === "premium" && row.status === "active") current.activePremium += 1;
      grouped.set(countryCode, current);
    }

    return {
      totalWorkspaces: rows.length,
      unknownCountryWorkspaces,
      countries: [...grouped.entries()]
        .map(([countryCode, values]) => ({ countryCode, ...values }))
        .sort((a, b) => b.workspaces - a.workspaces || a.countryCode.localeCompare(b.countryCode)),
    };
  });
