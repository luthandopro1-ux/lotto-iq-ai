import { runAnalysis, rankPairs } from "@/lib/engine";
import type { Draw, SessionKey, Strategy } from "@/lib/uk49";

/**
 * Analysis snapshot engine.
 *
 * The Analysis page used to call runAnalysis()/rankPairs() straight from
 * React state on every render, so nothing was ever saved and the same
 * top-5 / pairs figures were recomputed from scratch on every page load.
 * This module runs the exact same engine once, server-side, and writes
 * the result to `analysis_runs` so the dashboard and Analysis page can
 * read a stored figure instantly instead of recalculating it.
 */

export interface StoredTopNumber {
  number: number;
  score: number;
  agreement: number;
  strategies: string[];
}

export interface StoredTopPair {
  pair: [number, number];
  score: number;
  sharedStrategies: number;
  coOccurrences: number;
  coOccurrenceRate: number;
}

export interface StoredBreakdownEntry {
  strategyId: string;
  strategyName: string;
  numbers: number[];
  weight: number;
  error?: string;
}

export interface AnalysisSnapshotInput {
  targetDate: string;
  targetSession: SessionKey;
  strategies: Strategy[];
  history: Draw[];
  trigger?: "manual" | "daily-board" | "sync";
}

export interface AnalysisSnapshotRow {
  id: string;
  target_date: string;
  target_session: string;
  top_numbers: StoredTopNumber[];
  top_pairs: StoredTopPair[];
  breakdown: StoredBreakdownEntry[];
  strategy_count: number;
  trigger: string;
  created_at: string;
}

/**
 * Runs the analysis engine for one target draw and stores the top-5
 * numbers, top-5 pairs and a per-strategy breakdown as one row in
 * `analysis_runs`. History must already be filtered to draws strictly
 * before the target — callers pass whatever slice they consider "known"
 * at the time so no future information leaks in.
 */
export async function computeAndStoreAnalysisSnapshot(
  db: { from: (t: string) => any },
  input: AnalysisSnapshotInput,
): Promise<AnalysisSnapshotRow | null> {
  const { targetDate, targetSession, strategies, history, trigger = "manual" } = input;
  if (strategies.length === 0) return null;

  const result = runAnalysis(strategies, {
    date: new Date(`${targetDate}T12:00:00Z`),
    session: targetSession,
    history,
    previousThree: history.slice(0, 3),
  });
  if (result.ranked.length === 0) return null;

  const pairs = rankPairs(result.ranked, history, { limit: 5 });

  const topNumbers: StoredTopNumber[] = result.ranked.slice(0, 5).map((r) => ({
    number: r.number,
    score: Number(r.score.toFixed(2)),
    agreement: r.agreement,
    strategies: Array.from(new Set(r.hits.map((h) => h.strategy))),
  }));

  const topPairs: StoredTopPair[] = pairs.map((p) => ({
    pair: p.pair,
    score: Number(p.score.toFixed(2)),
    sharedStrategies: p.sharedStrategies,
    coOccurrences: p.coOccurrences,
    coOccurrenceRate: Number(p.coOccurrenceRate.toFixed(4)),
  }));

  const breakdown: StoredBreakdownEntry[] = result.perStrategy.map((p) => ({
    strategyId: p.strategy.id,
    strategyName: p.strategy.name,
    numbers: p.numbers,
    weight: Number(p.strategy.weight) || 1,
    ...(p.error ? { error: p.error } : {}),
  }));

  const payload = {
    target_date: targetDate,
    target_session: targetSession,
    previous_draw_ids: history.slice(0, 3).map((d) => d.id),
    top_numbers: topNumbers as never,
    top_pairs: topPairs as never,
    breakdown: breakdown as never,
    strategy_count: strategies.length,
    trigger,
  };

  const { data, error } = await db.from("analysis_runs").insert(payload).select("*").single();
  if (error || !data) return null;

  return {
    id: String(data.id),
    target_date: String(data.target_date),
    target_session: String(data.target_session),
    top_numbers: (data.top_numbers ?? []) as StoredTopNumber[],
    top_pairs: (data.top_pairs ?? []) as StoredTopPair[],
    breakdown: (data.breakdown ?? []) as StoredBreakdownEntry[],
    strategy_count: Number(data.strategy_count ?? 0),
    trigger: String(data.trigger ?? "manual"),
    created_at: String(data.created_at),
  };
}

/** Most recent stored snapshot for a target draw, or null if none exists yet. */
export async function latestAnalysisSnapshot(
  db: { from: (t: string) => any },
  targetDate: string,
  targetSession: SessionKey,
): Promise<AnalysisSnapshotRow | null> {
  const { data, error } = await db
    .from("analysis_runs")
    .select("*")
    .eq("target_date", targetDate)
    .eq("target_session", targetSession)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: String(data.id),
    target_date: String(data.target_date),
    target_session: String(data.target_session),
    top_numbers: (data.top_numbers ?? []) as StoredTopNumber[],
    top_pairs: (data.top_pairs ?? []) as StoredTopPair[],
    breakdown: (data.breakdown ?? []) as StoredBreakdownEntry[],
    strategy_count: Number(data.strategy_count ?? 0),
    trigger: String(data.trigger ?? "manual"),
    created_at: String(data.created_at),
  };
}

/**
 * Convenience wrapper used by the daily engine and the manual "recompute"
 * action: loads draws + enabled strategies for the given target from the
 * database itself, then computes and stores the snapshot.
 */
export async function runAndStoreAnalysisForTarget(
  db: { from: (t: string) => any },
  targetDate: string,
  targetSession: SessionKey,
  trigger: AnalysisSnapshotInput["trigger"] = "manual",
): Promise<AnalysisSnapshotRow | null> {
  const { SESSIONS } = await import("@/lib/uk49");
  const sessionIndex = (s: string) => SESSIONS.indexOf(s as (typeof SESSIONS)[number]);

  const [{ data: drawRows }, { data: strategyRows }] = await Promise.all([
    db.from("draws").select("*").order("draw_date", { ascending: false }).limit(600),
    db.from("strategies").select("*").eq("enabled", true),
  ]);

  const history = ((drawRows ?? []) as Draw[])
    .filter(
      (d) =>
        d.draw_date < targetDate ||
        (d.draw_date === targetDate && sessionIndex(d.session) < sessionIndex(targetSession)),
    )
    .sort((a, b) =>
      a.draw_date === b.draw_date
        ? sessionIndex(b.session) - sessionIndex(a.session)
        : a.draw_date < b.draw_date
          ? 1
          : -1,
    );

  return computeAndStoreAnalysisSnapshot(db, {
    targetDate,
    targetSession,
    strategies: (strategyRows ?? []) as Strategy[],
    history,
    trigger,
  });
}
