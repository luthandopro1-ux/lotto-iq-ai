import { computeStats, type StatLayer } from "@/lib/stats";
import {
  buildPrediction,
  buildLearning,
  gradePrediction,
  emptyLearning,
  sessionIndex,
  type PickedNumber,
} from "@/lib/predict";
import { drawNumbers, type Draw, type SessionKey, type Strategy } from "@/lib/uk49";
import type { Db } from "@/lib/db.server";

/**
 * BACKTESTING ENGINE — Model A–E comparison.
 *
 * Walks every draw in the requested date range in chronological order,
 * predicting each one from only the draws that came strictly before it
 * (no lookahead), and scores five named model variants against the
 * actual result:
 *
 *   A — Formula only        the rule-engine strategies (src/lib/engine.ts), unweighted by stats
 *   B — Statistical only     frequency / EMA / gap / Bayes / Markov / Monte Carlo (src/lib/stats.ts)
 *   C — Balanced blend       70% formula / 30% statistical
 *   D — Even blend           50% formula / 50% statistical
 *   E — Learning-adjusted    formula re-weighted by the same walk-forward
 *                            learning the production daily engine uses
 *                            (src/lib/predict.ts buildLearning)
 *
 * Results are persisted as one row in `backtests` so a run never has to
 * be recomputed to be viewed again, and so multiple runs can be compared
 * side by side.
 */

export const MODEL_DEFS = [
  { key: "A", label: "Formula only", description: "Pure rule-engine strategy agreement." },
  {
    key: "B",
    label: "Statistical only",
    description: "Frequency, EMA, gap, Bayes, Markov, Monte Carlo.",
  },
  { key: "C", label: "Balanced blend (70/30)", description: "70% formula, 30% statistical." },
  { key: "D", label: "Even blend (50/50)", description: "50% formula, 50% statistical." },
  {
    key: "E",
    label: "Learning-adjusted",
    description: "Formula re-weighted by recent hit/miss accuracy.",
  },
] as const;

export type ModelKey = (typeof MODEL_DEFS)[number]["key"];

export interface ModelMetrics {
  key: ModelKey;
  label: string;
  description: string;
  tests: number;
  totalMatches: number;
  avgMatches: number;
  bestMatches: number;
  hitRate: number;
  pairMatches: number;
  avgPairMatches: number;
}

export interface BacktestTimelinePoint {
  date: string;
  session: SessionKey;
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
}

export interface BacktestResults {
  generatedAt: string;
  drawsTested: number;
  models: ModelMetrics[];
  timeline: BacktestTimelinePoint[];
  best: ModelKey | null;
}

export interface BacktestRow {
  id: string;
  label: string | null;
  date_from: string;
  date_to: string;
  strategy_ids: string[];
  results: BacktestResults;
  created_at: string;
}

const pairMatchCount = (hits: number) => (hits * (hits - 1)) / 2;

/** Top-6 numbers from a formula pool, normalised score 0..1 for blending. */
function formulaTop(pool: PickedNumber[]) {
  const max = Math.max(...pool.map((p) => p.score), 1);
  const byNumber = new Map<number, number>();
  for (const p of pool) byNumber.set(p.n, Math.max(0, p.score) / max);
  return { top6: pool.slice(0, 6).map((p) => p.n), byNumber };
}

/** Top-6 numbers from the statistical layer. */
function statsTop(stats: StatLayer) {
  const byNumber = new Map<number, number>();
  for (const s of stats.numbers) byNumber.set(s.n, s.score);
  return { top6: stats.numbers.slice(0, 6).map((s) => s.n), byNumber };
}

/** Blended top-6, weight = formula share (1 = pure formula, 0 = pure stats). */
function blendedTop6(
  formulaByNumber: Map<number, number>,
  statsByNumber: Map<number, number>,
  weight: number,
): number[] {
  const combined = new Map<number, number>();
  for (const [n, v] of formulaByNumber) combined.set(n, weight * v);
  for (const [n, v] of statsByNumber) combined.set(n, (combined.get(n) ?? 0) + (1 - weight) * v);
  return Array.from(combined.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([n]) => n);
}

function scoreHits(top6: number[], actual: Set<number>) {
  return top6.filter((n) => actual.has(n)).length;
}

export interface RunBacktestOptions {
  dateFrom: string;
  dateTo: string;
  strategies: Strategy[];
  history: Draw[];
  label?: string;
  /** Statistical-layer Monte Carlo iterations; lower keeps long walks fast. */
  simulations?: number;
}

/**
 * Runs the walk-forward comparison and returns the metrics without
 * touching the database — used by runAndSaveBacktest() below and
 * reusable for tests.
 */
export function evaluateBacktest(options: RunBacktestOptions): BacktestResults {
  const { dateFrom, dateTo, strategies, simulations = 400 } = options;

  const chronological = [...options.history].sort((a, b) =>
    a.draw_date === b.draw_date
      ? sessionIndex(a.session) - sessionIndex(b.session)
      : a.draw_date < b.draw_date
        ? -1
        : 1,
  );

  const targets = chronological.filter((d) => d.draw_date >= dateFrom && d.draw_date <= dateTo);

  const totals: Record<
    ModelKey,
    { matches: number; best: number; hitDraws: number; pairs: number }
  > = {
    A: { matches: 0, best: 0, hitDraws: 0, pairs: 0 },
    B: { matches: 0, best: 0, hitDraws: 0, pairs: 0 },
    C: { matches: 0, best: 0, hitDraws: 0, pairs: 0 },
    D: { matches: 0, best: 0, hitDraws: 0, pairs: 0 },
    E: { matches: 0, best: 0, hitDraws: 0, pairs: 0 },
  };
  const timeline: BacktestTimelinePoint[] = [];
  let tests = 0;

  // Rolling walk-forward learning state for Model E — mirrors exactly what
  // the production daily engine accumulates from graded predictions.
  const gradedLog: {
    target_date: string;
    target_session: SessionKey;
    grading: ReturnType<typeof gradePrediction>;
  }[] = [];

  for (const target of targets) {
    const before = chronological.filter(
      (d) =>
        d.draw_date < target.draw_date ||
        (d.draw_date === target.draw_date &&
          sessionIndex(d.session) < sessionIndex(target.session)),
    );
    if (before.length < 15 || strategies.length === 0) continue;

    const actual = new Set(drawNumbers(target));

    // --- Model A: pure formula, no learning ---------------------------
    const predictionA = buildPrediction(
      strategies,
      { targetDate: target.draw_date, targetSession: target.session, history: before },
      { learning: emptyLearning() },
    );
    if (predictionA.pool.length < 6) continue;
    const { top6: topA, byNumber: formulaByNumber } = formulaTop(predictionA.pool);

    // --- Model B: pure statistics --------------------------------------
    const stats = computeStats(before, { simulations });
    if (stats.numbers.length < 6) continue;
    const { top6: topB, byNumber: statsByNumber } = statsTop(stats);

    // --- Models C & D: blends -------------------------------------------
    const topC = blendedTop6(formulaByNumber, statsByNumber, 0.7);
    const topD = blendedTop6(formulaByNumber, statsByNumber, 0.5);

    // --- Model E: formula + walk-forward learning -----------------------
    const learning = buildLearning(gradedLog, target.draw_date);
    const predictionE = buildPrediction(
      strategies,
      { targetDate: target.draw_date, targetSession: target.session, history: before },
      { learning },
    );
    const topE = predictionE.pool.length >= 6 ? formulaTop(predictionE.pool).top6 : topA;

    const hits: Record<ModelKey, number> = {
      A: scoreHits(topA, actual),
      B: scoreHits(topB, actual),
      C: scoreHits(topC, actual),
      D: scoreHits(topD, actual),
      E: scoreHits(topE, actual),
    };

    for (const key of Object.keys(hits) as ModelKey[]) {
      const t = totals[key];
      const h = hits[key];
      t.matches += h;
      t.best = Math.max(t.best, h);
      if (h > 0) t.hitDraws += 1;
      t.pairs += pairMatchCount(h);
    }
    tests += 1;

    timeline.push({ date: target.draw_date, session: target.session, ...hits });

    // Feed Model E's own grading back into the rolling learning log so
    // the next iteration adapts exactly like production does.
    const gradingE = gradePrediction(predictionE, target);
    gradedLog.unshift({
      target_date: target.draw_date,
      target_session: target.session,
      grading: gradingE,
    });
    if (gradedLog.length > 12) gradedLog.length = 12;
  }

  const models: ModelMetrics[] = MODEL_DEFS.map((def) => {
    const t = totals[def.key];
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      tests,
      totalMatches: t.matches,
      avgMatches: tests ? t.matches / tests : 0,
      bestMatches: t.best,
      hitRate: tests ? (t.hitDraws / tests) * 100 : 0,
      pairMatches: t.pairs,
      avgPairMatches: tests ? t.pairs / tests : 0,
    };
  });

  const best = models.reduce<ModelKey | null>((acc, m) => {
    if (!acc) return m.key;
    const accModel = models.find((x) => x.key === acc)!;
    return m.avgMatches > accModel.avgMatches ? m.key : acc;
  }, null);

  return {
    generatedAt: new Date().toISOString(),
    drawsTested: tests,
    models,
    timeline: timeline.slice(-60),
    best,
  };
}

/** Runs the comparison and stores it as one row in `backtests`. */
export async function runAndSaveBacktest(
  db: Db,
  options: RunBacktestOptions,
): Promise<BacktestRow> {
  const results = evaluateBacktest(options);
  const payload = {
    label: options.label ?? null,
    date_from: options.dateFrom,
    date_to: options.dateTo,
    strategy_ids: options.strategies.map((s) => s.id),
    results: results as never,
  };

  const { data, error } = await db.from("backtests").insert(payload).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Backtest could not be saved.");

  return {
    id: String(data.id),
    label: (data.label as string | null) ?? null,
    date_from: String(data.date_from),
    date_to: String(data.date_to),
    strategy_ids: (data.strategy_ids ?? []) as string[],
    results: data.results as unknown as BacktestResults,
    created_at: String(data.created_at),
  };
}

export async function listSavedBacktests(db: Db, limit = 20): Promise<BacktestRow[]> {
  const { data } = await db
    .from("backtests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    label: (row.label as string | null) ?? null,
    date_from: String(row.date_from),
    date_to: String(row.date_to),
    strategy_ids: (row.strategy_ids ?? []) as string[],
    results: row.results as unknown as BacktestResults,
    created_at: String(row.created_at),
  }));
}

export async function getSavedBacktest(db: Db, id: string): Promise<BacktestRow | null> {
  const { data, error } = await db.from("backtests").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return {
    id: String(data.id),
    label: (data.label as string | null) ?? null,
    date_from: String(data.date_from),
    date_to: String(data.date_to),
    strategy_ids: (data.strategy_ids ?? []) as string[],
    results: data.results as unknown as BacktestResults,
    created_at: String(data.created_at),
  };
}
