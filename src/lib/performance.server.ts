import { adaptiveLayer } from "@/lib/adaptive";
import { structuralSequence } from "@/lib/structure";
import type { Draw, SessionKey, Strategy } from "@/lib/uk49";
import type { Db } from "@/lib/db.server";

/**
 * Persist the walk-forward strategy performance so the long-term record
 * survives between runs and the UI does not have to replay history on
 * every page load. Purely additive: it never changes a saved prediction.
 */
export async function persistStrategyPerformance(
  db: Db,
  strategies: Strategy[],
  history: Draw[],
  target: { date: string; session: SessionKey },
): Promise<string[]> {
  const errors: string[] = [];
  if (strategies.length === 0 || history.length < 20) return errors;

  const report = adaptiveLayer(strategies, structuralSequence(history), target, 80);
  if (report.strategies.length === 0) return errors;

  const computedAt = new Date().toISOString();
  const windowRow = (
    s: (typeof report.strategies)[number],
    label: string,
    rate: number,
    score: number,
  ) => ({
    strategy_id: s.strategyId,
    tests: s.tests,
    matches: Math.round(rate * s.tests),
    avg_matches: Number((rate * 6).toFixed(4)),
    pair_matches: Math.round(s.confirmation * s.tests),
    score: Number(score.toFixed(2)),
    window_label: label,
    computed_at: computedAt,
  });
  const rows = report.strategies.flatMap((s) => [
    windowRow(s, "walkforward", s.historical, s.score),
    windowRow(s, "alltime", s.windows.allTime, s.windows.allTime * 100),
    windowRow(s, "365d", s.windows.d365, s.windows.d365 * 100),
    windowRow(s, "90d", s.windows.d90, s.windows.d90 * 100),
    windowRow(s, "30d", s.windows.d30, s.windows.d30 * 100),
  ]);

  const { error } = await db
    .from("strategy_performance")
    .upsert(rows, { onConflict: "strategy_id,window_label" });
  if (error) errors.push(`strategy performance not saved: ${error.message}`);
  return errors;
}
