import { createServerFn } from "@tanstack/react-start";

/**
 * Public, non-sensitive product status for the marketing homepage.
 * Only aggregate counts are returned; draw rows and strategy details stay in the app.
 */
export const getPublicProductStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { serverDb } = await import("@/lib/db.server");
  const db = serverDb();
  const [{ count: draws, error: drawsError }, { count: strategies, error: strategiesError }, { count: activeStrategies, error: activeError }] = await Promise.all([
    db.from("draws").select("id", { count: "exact", head: true }),
    db.from("strategies").select("id", { count: "exact", head: true }),
    db.from("strategies").select("id", { count: "exact", head: true }).eq("enabled", true),
  ]);
  if (drawsError || strategiesError || activeError) {
    throw new Error(drawsError?.message ?? strategiesError?.message ?? activeError?.message ?? "Product status unavailable.");
  }
  return {
    drawsStored: draws ?? 0,
    strategies: strategies ?? 0,
    activeStrategies: activeStrategies ?? 0,
    engineReady: (activeStrategies ?? 0) > 0,
  };
});
