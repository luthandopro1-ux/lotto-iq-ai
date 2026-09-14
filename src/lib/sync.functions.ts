import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const HistoryInput = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  session: z.string().optional(),
  outcome: z.string().optional(),
});

/** Permanent prediction ledger — what was locked before each draw and how it scored. */
export const predictionHistory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => HistoryInput.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { serverDb } = await import("@/lib/db.server");
    const { toLedger } = await import("@/lib/daily.server");
    let q = serverDb()
      .from("predictions")
      .select("*")
      .order("target_date", { ascending: false })
      .limit(data.limit ?? 60);
    if (data.session) q = q.eq("target_session", data.session);
    if (data.outcome) q = q.eq("outcome", data.outcome);
    const { data: rows } = await q;
    const list = (rows ?? [])
      .map((r) => toLedger(r as unknown as Record<string, unknown>))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const graded = list.filter((r) => r.status === "graded");
    return {
      records: list,
      stats: {
        total: list.length,
        graded: graded.length,
        hits: graded.filter((r) => r.outcome === "HIT").length,
        partial: graded.filter((r) => r.outcome === "PARTIAL").length,
        miss: graded.filter((r) => r.outcome === "MISS").length,
        avgMatched: graded.length
          ? Number((graded.reduce((a, r) => a + r.matched_count, 0) / graded.length).toFixed(2))
          : 0,
      },
    };
  });

/** Synchronisation log: last runs, latest detected draw per session, gaps. */
export const syncStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { serverDb } = await import("@/lib/db.server");
  const { missingSlots } = await import("@/lib/ingest.server");
  const { SESSIONS } = await import("@/lib/uk49");
  const { drawId, nextTarget, ukClock, ukDate, SESSION_SCHEDULE } = await import("@/lib/sessions");
  const db = serverDb();
  const now = new Date();

  const [{ data: runs }, { data: latest }, missing] = await Promise.all([
    db.from("ingest_runs").select("*").order("started_at", { ascending: false }).limit(8),
    db
      .from("draws")
      .select("draw_date,session,provider,imported_at")
      .order("draw_date", {
        ascending: false,
      })
      .limit(40),
    missingSlots(4, now),
  ]);

  const perSession = SESSIONS.map((session) => {
    const row = (latest ?? []).find((d) => d.session === session);
    return {
      session,
      label: SESSION_SCHEDULE[session].label,
      ukTime: SESSION_SCHEDULE[session].ukTime,
      latest: row ? drawId(row.draw_date, session) : null,
      importedAt: row?.imported_at ?? null,
      provider: row?.provider ?? null,
    };
  });

  const target = nextTarget(now);
  return {
    ukNow: `${ukDate(now)} ${ukClock(now)}`,
    runs: (runs ?? []).map((r) => ({
      id: r.id as string,
      provider: r.provider as string,
      mode: r.mode as string,
      status: r.status as string,
      startedAt: r.started_at as string,
      finishedAt: (r.finished_at as string | null) ?? null,
      found: Number(r.found ?? 0),
      inserted: Number(r.inserted ?? 0),
      skipped: Number(r.skipped ?? 0),
      rejected: Number(r.rejected ?? 0),
      error: (r.error as string | null) ?? null,
    })),
    perSession,
    missing: missing.map((m) => ({ drawId: m.drawId, overdue: m.overdue })),
    nextTarget: drawId(target.date, target.session),
  };
});
