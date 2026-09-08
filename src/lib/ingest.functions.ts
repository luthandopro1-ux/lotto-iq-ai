import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SESSIONS } from "@/lib/uk49";
import { adminGuard } from "@/lib/admin-guard";

const SessionEnum = z.enum(SESSIONS);

const SyncInput = z.object({
  sessions: z.array(SessionEnum).optional(),
  trigger: z.string().optional(),
});

const BackfillInput = z.object({
  year: z.number().int().min(1997).max(2100),
  sessions: z.array(SessionEnum).optional(),
});

/** Pull the provider's rolling recent window for the selected sessions. */
export const syncLatestDraws = createServerFn({ method: "POST" })
  .middleware([adminGuard])
  .inputValidator((input: unknown) => SyncInput.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { runIngest } = await import("@/lib/ingest.server");
    return runIngest({
      mode: "recent",
      ...(data.sessions ? { sessions: data.sessions } : {}),
      trigger: data.trigger ?? "manual",
    });
  });

/** Load one full calendar year of history. */
export const backfillYear = createServerFn({ method: "POST" })
  .middleware([adminGuard])
  .inputValidator((input: unknown) => BackfillInput.parse(input))
  .handler(async ({ data }) => {
    const { runIngest } = await import("@/lib/ingest.server");
    return runIngest({
      mode: "year",
      year: data.year,
      ...(data.sessions ? { sessions: data.sessions } : {}),
    });
  });

/** Coverage + missing dates per session. */
export const drawCoverage = createServerFn({ method: "GET" }).handler(async () => {
  const { findGaps } = await import("@/lib/ingest.server");
  return findGaps();
});

/** Last few ingest runs, for the sync-health panel. */
export const recentIngestRuns = createServerFn({ method: "GET" }).handler(async () => {
  const { serverDb } = await import("@/lib/db.server");
  const { data } = await serverDb()
    .from("ingest_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10);
  return data ?? [];
});
