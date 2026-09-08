import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SESSIONS } from "@/lib/uk49";
import { adminGuard } from "@/lib/admin-guard";

const SessionEnum = z.enum(SESSIONS);

const SnapshotInput = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetSession: SessionEnum,
});

/** Latest saved analysis_runs row for a target draw, or null if none yet. */
export const getAnalysisSnapshot = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => SnapshotInput.parse(input))
  .handler(async ({ data }) => {
    const { serverDb } = await import("@/lib/db.server");
    const { latestAnalysisSnapshot } = await import("@/lib/analysis.server");
    return latestAnalysisSnapshot(serverDb(), data.targetDate, data.targetSession);
  });

/**
 * Recomputes the analysis for a target draw and stores a fresh snapshot.
 * Used by the "Recompute & save" button on the Analysis page, and by the
 * daily sync engine after new results land.
 */
export const refreshAnalysisSnapshot = createServerFn({ method: "POST" })
  .middleware([adminGuard])
  .inputValidator((input: unknown) => SnapshotInput.parse(input))
  .handler(async ({ data }) => {
    const { serverDb } = await import("@/lib/db.server");
    const { runAndStoreAnalysisForTarget } = await import("@/lib/analysis.server");
    const snapshot = await runAndStoreAnalysisForTarget(
      serverDb(),
      data.targetDate,
      data.targetSession,
      "manual",
    );
    if (!snapshot) {
      throw new Error(
        "Nothing to analyse yet — import history and enable at least one strategy first.",
      );
    }
    return snapshot;
  });

/** Recent snapshot history for a target draw, newest first. */
export const listAnalysisSnapshots = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => SnapshotInput.extend({ limit: z.number().int().min(1).max(50).optional() }).parse(input))
  .handler(async ({ data }) => {
    const { serverDb } = await import("@/lib/db.server");
    const db = serverDb();
    const { data: rows } = await db
      .from("analysis_runs")
      .select("*")
      .eq("target_date", data.targetDate)
      .eq("target_session", data.targetSession)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 10);
    return rows ?? [];
  });
