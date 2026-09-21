import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-guard";

const MAX_BACKTEST_DAYS = 120;

const RunInput = z
  .object({
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    strategyIds: z.array(z.string()).optional(),
    label: z.string().max(120).optional(),
  })
  .refine(
    (v) => {
      const days = (Date.parse(v.dateTo) - Date.parse(v.dateFrom)) / 86_400_000;
      return days >= 0 && days <= MAX_BACKTEST_DAYS;
    },
    {
      message: `Backtest range can't exceed ${MAX_BACKTEST_DAYS} days per run — Cloudflare Workers meter CPU time per request, and walk-forward testing a full year in one call exceeds that budget. Run it in shorter windows (e.g. quarterly) instead.`,
    },
  );

/** Runs the Model A–E walk-forward comparison and saves it to `backtests`. */
export const runBacktest = createServerFn({ method: "POST" })
  .middleware([adminGuard])
  .inputValidator((input: unknown) => RunInput.parse(input))
  .handler(async ({ data }) => {
    const { serverDb } = await import("@/lib/db.server");
    const { runAndSaveBacktest } = await import("@/lib/backtest.server");
    const db = serverDb();

    const [{ data: drawRows }, { data: strategyRows }] = await Promise.all([
      db
        .from("draws")
        .select("*")
        .lte("draw_date", data.dateTo)
        .order("draw_date", { ascending: false })
        // Bounds not just the tested range but each test draw's own
        // lookback window — the real CPU driver, since every one of
        // the (now capped) test draws re-scans this whole set.
        .limit(800),
      db.from("strategies").select("*"),
    ]);

    const allStrategies = strategyRows ?? [];
    const strategies =
      data.strategyIds && data.strategyIds.length > 0
        ? allStrategies.filter((s) => data.strategyIds!.includes(s.id))
        : allStrategies.filter((s) => s.enabled);

    if (strategies.length === 0) {
      throw new Error("Select at least one strategy (or enable one) before running a backtest.");
    }
    if (!drawRows || drawRows.length === 0) {
      throw new Error("No draws found — import history first.");
    }

    return runAndSaveBacktest(db, {
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      strategies: strategies as never,
      history: drawRows as never,
      ...(data.label ? { label: data.label } : {}),
    });
  });

/** Recent saved backtest runs, newest first. */
export const listBacktests = createServerFn({ method: "GET" }).handler(async () => {
  const { serverDb } = await import("@/lib/db.server");
  const { listSavedBacktests } = await import("@/lib/backtest.server");
  return listSavedBacktests(serverDb());
});

const GetInput = z.object({ id: z.string().uuid() });

/** One saved backtest run by id. */
export const getBacktest = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => GetInput.parse(input))
  .handler(async ({ data }) => {
    const { serverDb } = await import("@/lib/db.server");
    const { getSavedBacktest } = await import("@/lib/backtest.server");
    return getSavedBacktest(serverDb(), data.id);
  });
