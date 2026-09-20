import { createServerFn } from "@tanstack/react-start";
import { requireAccessContext } from "@/lib/authorization.server";

export type CapacityMetrics = {
  config: { active_user_soft_limit: number; alert_percent: number; critical_percent: number };
  current: {
    bucket_start?: string;
    active_users_estimate?: number;
    requests?: number;
    errors?: number;
    average_latency_ms?: number;
    max_latency_ms?: number;
    capacity_percent?: number;
    alert_level?: "normal" | "warning" | "critical";
  };
  hourly: Array<{
    hour_start: string;
    peak_active_users_estimate: number;
    requests: number;
    errors: number;
    average_latency_ms: number | null;
  }>;
  busy_periods: Array<{
    hour_of_day: number;
    peak_active_users_estimate: number;
    requests: number;
  }>;
};

type MetricsDb = {
  rpc: (
    name: "get_capacity_metrics",
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function isMetrics(value: unknown): value is CapacityMetrics {
  return Boolean(
    value &&
    typeof value === "object" &&
    "config" in value &&
    "current" in value &&
    "hourly" in value &&
    "busy_periods" in value,
  );
}

export const getCapacityMetrics = createServerFn({ method: "GET" })
  .middleware([requireAccessContext])
  .handler(async ({ context }): Promise<CapacityMetrics> => {
    if (context.accessContext.role !== "administrator")
      throw new Error("Administrator access required.");
    const db = context.supabase as unknown as MetricsDb;
    const { data, error } = await db.rpc("get_capacity_metrics");
    if (error) throw new Error(`Failed to load capacity metrics: ${error.message}`);
    if (!isMetrics(data)) throw new Error("Capacity metrics response was invalid.");
    return data;
  });
