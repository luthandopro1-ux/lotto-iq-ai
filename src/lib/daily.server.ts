import { SESSIONS, type SessionKey } from "@/lib/uk49";
import {
  drawId,
  drawInstant,
  drawTimePassed,
  drawOverdue,
  sessionState,
  ukClock,
  ukDate,
  nextTarget,
  SESSION_SCHEDULE,
  type DrawState,
} from "@/lib/sessions";
import type { CatchUpReport, MissingSlot } from "@/lib/ingest.server";
import type { Grading, PickedNumber, PredictionRow } from "@/lib/predict";

// Narrow RPC surface for upsert_strategy_predictions. Not in the
// generated Supabase types (src/integrations/supabase/types.ts) because
// that file is a snapshot from before this migration existed and hasn't
// been regenerated since — same reason authorization.server.ts declares
// its own narrow type for the is_administrator RPC rather than using
// the full generated Database type for that call.
type StrategyPredictionsRpc = {
  rpc: (
    fn: "upsert_strategy_predictions",
    args: {
      p_draw_id: string;
      p_draw_time: string;
      p_predictions: Array<{
        strategy_id: string;
        predicted_numbers: number[];
        predicted_banker: number | null;
        predicted_bonus: number | null;
      }>;
    },
  ) => Promise<{ error: { message: string } | null }>;
};

export interface LedgerRecord {
  id: string;
  drawId: string;
  target_date: string;
  target_session: SessionKey;
  generated_at: string;
  locked_at: string;
  banker: number | null;
  bankers: PickedNumber[];
  rows: PredictionRow[];
  pool: PickedNumber[];
  status: string;
  outcome: string | null;
  matched_count: number;
  strategy_count: number;
  history_depth: number;
  history_cutoff_date: string | null;
  history_cutoff_session: SessionKey | null;
  history_cutoff_draw_id: string | null;
  model_version: string | null;
  feature_version: string | null;
  strategy_version: string | null;
  grading: Grading | null;
  actual: { numbers: number[]; booster: number | null } | null;
  graded_at: string | null;
}

export interface DrawRecord {
  id: string;
  drawId: string;
  draw_date: string;
  session: SessionKey;
  numbers: number[];
  booster: number | null;
  session_verified: boolean;
  provider: string | null;
}

type Row = Record<string, unknown>;

export function toLedger(p: Row | null | undefined): LedgerRecord | null {
  if (!p) return null;
  return {
    id: String(p["id"]),
    drawId: drawId(String(p["target_date"]), p["target_session"] as SessionKey),
    target_date: String(p["target_date"]),
    target_session: p["target_session"] as SessionKey,
    generated_at: String(p["generated_at"]),
    locked_at: String(p["locked_at"] ?? p["generated_at"]),
    banker: (p["banker"] as number | null) ?? null,
    bankers: (p["bankers"] ?? []) as PickedNumber[],
    rows: (p["rows"] ?? []) as PredictionRow[],
    pool: (p["pool"] ?? []) as PickedNumber[],
    status: String(p["status"] ?? "pending"),
    outcome: (p["outcome"] as string | null) ?? null,
    matched_count: Number(p["matched_count"] ?? 0),
    strategy_count: Number(p["strategy_count"] ?? 0),
    history_depth: Number(p["history_depth"] ?? 0),
    history_cutoff_date: (p["history_cutoff_date"] as string | null) ?? null,
    history_cutoff_session: (p["history_cutoff_session"] as SessionKey | null) ?? null,
    history_cutoff_draw_id: (p["history_cutoff_draw_id"] as string | null) ?? null,
    model_version: (p["model_version"] as string | null) ?? null,
    feature_version: (p["feature_version"] as string | null) ?? null,
    strategy_version: (p["strategy_version"] as string | null) ?? null,
    grading: (p["grading"] as Grading | null) ?? null,
    actual: (p["actual"] as { numbers: number[]; booster: number | null } | null) ?? null,
    graded_at: (p["graded_at"] as string | null) ?? null,
  };
}

export function toDrawRecord(d: Row | null | undefined): DrawRecord | null {
  if (!d) return null;
  return {
    id: String(d["id"]),
    drawId: drawId(String(d["draw_date"]), d["session"] as SessionKey),
    draw_date: String(d["draw_date"]),
    session: d["session"] as SessionKey,
    numbers: [d["n1"], d["n2"], d["n3"], d["n4"], d["n5"], d["n6"]].map(Number),
    booster: (d["booster"] as number | null) ?? null,
    session_verified: d["session_verified"] !== false,
    provider: (d["provider"] as string | null) ?? null,
  };
}

export interface DailyBoardOptions {
  date?: string;
  sync?: boolean;
}

export interface SessionSlot {
  drawId: string;
  session: SessionKey;
  label: string;
  ukTime: string;
  drawAt: string;
  state: DrawState;
  blocked: boolean;
  blockedReason: string | null;
  prediction: LedgerRecord | null;
  draw: DrawRecord | null;
}

const overall = (matched: number, bankerHit: boolean): "HIT" | "PARTIAL" | "MISS" => {
  if (matched >= 3 || bankerHit) return "HIT";
  if (matched > 0) return "PARTIAL";
  return "MISS";
};

/**
 * The daily engine — one pass of the draw state machine.
 *
 * 1. catch up on any missing draw (never skip Drive Time)
 * 2. walk Brunch → Lunch → Drive Time → Tea Time in order
 * 3. grade the locked prediction of every session whose result has landed
 * 4. learn from those hits and misses
 * 5. lock a fresh prediction for the next session that has not drawn yet,
 *    but only once every earlier session of the day is verified
 */
export async function runDailyBoard(data: DailyBoardOptions = {}) {
  const { serverDb } = await import("@/lib/db.server");
  const { buildPrediction, buildLearning, gradePrediction, sessionIndex, dailySequence } =
    await import("@/lib/predict");
  const db = serverDb(true);

  const now = new Date();
  const targetDate = data.date ?? ukDate(now);

  /* ---- 1. sync + catch-up --------------------------------------- */
  const syncErrors: string[] = [];
  let catchup: CatchUpReport | null = null;
  let gradedNow = 0;
  if (data.sync !== false) {
    try {
      const { runIngest, catchUp } = await import("@/lib/ingest.server");
      const ingest = await runIngest({ mode: "recent", trigger: "daily-board" });
      syncErrors.push(...ingest.errors);
      catchup = await catchUp(4, now);
    } catch (err) {
      syncErrors.push(err instanceof Error ? err.message : String(err));
    }
  }

  const [
    { data: drawRows, error: drawRowsError },
    { data: strategyRows, error: strategyRowsError },
    { data: predictionRows, error: predictionRowsError },
  ] = await Promise.all([
    db.from("draws").select("*").order("draw_date", { ascending: false }).limit(600),
    db.from("strategies").select("*").eq("enabled", true),
    db.from("predictions").select("*").order("target_date", { ascending: false }).limit(60),
  ]);
  if (drawRowsError)
    syncErrors.push(`Failed to load draws for board build: ${drawRowsError.message}`);
  if (strategyRowsError)
    syncErrors.push(`Failed to load strategies for board build: ${strategyRowsError.message}`);
  if (predictionRowsError)
    syncErrors.push(`Failed to load predictions for board build: ${predictionRowsError.message}`);

  const history = (drawRows ?? []) as never[] as import("@/lib/uk49").Draw[];
  const strategies = (strategyRows ?? []) as never[] as import("@/lib/uk49").Strategy[];
  const predictions = predictionRows ?? [];
  if (strategies.length === 0 && !strategyRowsError) {
    syncErrors.push(
      "No enabled strategies found — every session will be skipped and no prediction will be written this run.",
    );
  }

  const drawFor = (date: string, session: string) =>
    history.find((d) => d.draw_date === date && d.session === session);
  const predictionFor = (date: string, session: string) =>
    predictions.find((p) => p.target_date === date && p.target_session === session);

  /* ---- 2 + 3. grade every landed draw, oldest first --------------- */
  const pending = predictions
    .filter((p) => p.status !== "graded")
    .sort((a, b) =>
      a.target_date === b.target_date
        ? sessionIndex(a.target_session as SessionKey) -
          sessionIndex(b.target_session as SessionKey)
        : a.target_date < b.target_date
          ? -1
          : 1,
    );

  for (const p of pending) {
    const draw = drawFor(p.target_date, p.target_session);
    if (!draw) continue;
    const grading = gradePrediction(
      {
        target_date: p.target_date,
        target_session: p.target_session as SessionKey,
        bankers: (p.bankers ?? []) as never,
        rows: (p.rows ?? []) as never,
        pool: (p.pool ?? []) as never,
        strategy_count: p.strategy_count,
        history_depth: p.history_depth,
      },
      draw,
    );
    const bankerHit = grading.rows.some((r) => r.bankerHit);
    const { data: updated } = await db
      .from("predictions")
      .update({
        status: "graded",
        session_state: "ANALYZED",
        draw_id: draw.id,
        actual: { numbers: grading.actual, booster: grading.booster },
        grading: grading as never,
        matched_count: grading.matched,
        outcome: overall(grading.matched, bankerHit),
        graded_at: new Date().toISOString(),
      })
      .eq("id", p.id)
      .select("*")
      .single();
    if (updated) Object.assign(p, updated);
    gradedNow += 1;

    try {
      const { latestAnalysisSnapshot } = await import("@/lib/analysis.server");
      const snapshot = await latestAnalysisSnapshot(
        db,
        p.target_date,
        p.target_session as SessionKey,
      );
      if (snapshot && snapshot.breakdown.length > 0) {
        const { error: spError } = await (db as unknown as StrategyPredictionsRpc).rpc(
          "upsert_strategy_predictions",
          {
            p_draw_id: draw.id,
            p_draw_time: SESSION_SCHEDULE[p.target_session as SessionKey].ukTime,
            p_predictions: snapshot.breakdown.map((b) => ({
              strategy_id: b.strategyId,
              predicted_numbers: b.numbers,
              predicted_banker: null,
              predicted_bonus: null,
            })),
          },
        );
        if (spError) syncErrors.push(`strategy_predictions not saved: ${spError.message}`);
      }
    } catch (err) {
      syncErrors.push(
        `strategy_predictions not saved: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /* ---- 4. learn --------------------------------------------------- */
  const graded = predictions
    .filter((p) => p.status === "graded" && p.grading)
    .sort((a, b) =>
      a.target_date === b.target_date
        ? sessionIndex(b.target_session as SessionKey) -
          sessionIndex(a.target_session as SessionKey)
        : a.target_date < b.target_date
          ? 1
          : -1,
    )
    .slice(0, 12)
    .map((p) => ({
      target_date: p.target_date,
      target_session: p.target_session as SessionKey,
      grading: p.grading as never,
    }));

  /* ---- 5. lock predictions, in strict session order --------------- */
  const blocked: Record<string, string | null> = {};
  const unresolved: string[] = [];
  let blockedBy: string | null = null;

  for (const session of SESSIONS) {
    const cfg = SESSION_SCHEDULE[session];
    const existingDraw = drawFor(targetDate, session);
    const existing = predictionFor(targetDate, session);
    const passed = drawTimePassed(targetDate, session, now);

    // An earlier session of the same day has drawn but has no verified
    // result yet — the sequence is incomplete, so nothing further is
    // predicted until it is recovered.
    if (blockedBy) {
      blocked[session] = blockedBy;
      continue;
    }
    if (passed && !existingDraw) {
      // Inside the grace window the sequence pauses and waits for the
      // result. Past it we flag the gap loudly and keep predicting, so a
      // stale feed can never silence the rest of the day.
      unresolved.push(drawId(targetDate, session));
      if (!drawOverdue(targetDate, session, now)) {
        blockedBy = `${cfg.label} result not yet verified`;
      }
      blocked[session] = null;
      continue;
    }

    blocked[session] = null;
    if (existing) continue; // ledger entries are locked, never regenerated
    if (passed) continue; // never invent a prediction after the fact
    if (strategies.length === 0) continue;

    // Product contract: Brunch and Lunch share one live prediction. Lunch
    // receives a separate immutable ledger row so its result can still be
    // graded independently, while Drive Time and Tea Time remain fresh
    // per-session predictions generated from the latest verified history.
    const brunchPrediction = session === "lunch" ? predictionFor(targetDate, "brunch") : null;
    if (brunchPrediction) {
      const brunch = brunchPrediction as never as Record<string, unknown>;
      const pairedPayload = {
        target_date: targetDate,
        target_session: session,
        banker: brunch["banker"],
        bankers: brunch["bankers"],
        rows: brunch["rows"],
        pool: brunch["pool"],
        sequence: brunch["sequence"],
        learning: brunch["learning"],
        strategy_count: brunch["strategy_count"],
        history_depth: brunch["history_depth"],
        history_cutoff_date: brunch["history_cutoff_date"],
        history_cutoff_session: brunch["history_cutoff_session"],
        history_cutoff_draw_id: brunch["history_cutoff_draw_id"],
        model_version: brunch["model_version"],
        feature_version: brunch["feature_version"],
        strategy_version: brunch["strategy_version"],
        status: "pending",
        session_state: "PREDICTION_READY",
        generated_at: new Date().toISOString(),
        locked_at: new Date().toISOString(),
      };
      const { data: pairedSaved, error: pairedSaveError } = await db
        .from("predictions")
        .upsert(pairedPayload as never, {
          onConflict: "target_date,target_session",
          ignoreDuplicates: true,
        })
        .select("*")
        .maybeSingle();
      if (pairedSaveError)
        syncErrors.push(`${cfg.label} paired prediction not saved: ${pairedSaveError.message}`);
      if (pairedSaved) predictions.unshift(pairedSaved);

      const { data: brunchAnalysis } = await db
        .from("analysis_runs")
        .select("previous_draw_ids,top_numbers,top_pairs,breakdown,strategy_count,trigger")
        .eq("target_date", targetDate)
        .eq("target_session", "brunch")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (brunchAnalysis) {
        const { error: pairedAnalysisError } = await db.from("analysis_runs").insert({
          target_date: targetDate,
          target_session: session,
          previous_draw_ids: brunchAnalysis.previous_draw_ids,
          top_numbers: brunchAnalysis.top_numbers,
          top_pairs: brunchAnalysis.top_pairs,
          breakdown: brunchAnalysis.breakdown,
          strategy_count: brunchAnalysis.strategy_count,
          trigger: "daily-board",
        });
        if (pairedAnalysisError)
          syncErrors.push(`${cfg.label} paired ensemble not saved: ${pairedAnalysisError.message}`);
      }
      continue;
    }

    const learning = buildLearning(graded, targetDate, {
      targetDate,
      targetSession: session,
    });
    const historyBeforeTarget = history
      .filter(
        (d) =>
          d.draw_date < targetDate ||
          (d.draw_date === targetDate && sessionIndex(d.session) < sessionIndex(session)),
      )
      .sort((a, b) =>
        a.draw_date === b.draw_date
          ? sessionIndex(b.session) - sessionIndex(a.session)
          : a.draw_date < b.draw_date
            ? 1
            : -1,
      );

    const prediction = buildPrediction(
      strategies,
      { targetDate, targetSession: session, history },
      { learning },
    );
    if (prediction.rows.length === 0) continue;

    const sequence = dailySequence(history, targetDate, session).map((d) => ({
      drawId: drawId(d.draw_date, d.session),
      numbers: [d.n1, d.n2, d.n3, d.n4, d.n5, d.n6],
      booster: d.booster,
    }));

    const payload = {
      target_date: targetDate,
      target_session: session,
      banker: prediction.bankers[0]?.n ?? null,
      bankers: prediction.bankers as never,
      rows: prediction.rows as never,
      pool: prediction.pool as never,
      sequence: { window: sequence } as never,
      learning: {
        sampleSize: learning.sampleSize,
        recentMisses: learning.recentMisses,
        recentHits: learning.recentHits,
        strategyMultiplier: learning.strategyMultiplier,
      } as never,
      strategy_count: prediction.strategy_count,
      history_depth: prediction.history_depth,
      history_cutoff_date: historyBeforeTarget[0]?.draw_date ?? null,
      history_cutoff_session: historyBeforeTarget[0]?.session ?? null,
      history_cutoff_draw_id: historyBeforeTarget[0]?.id ?? null,
      model_version: "uk49-ensemble-v1",
      feature_version: "uk49-history-v1",
      status: "pending",
      session_state: "PREDICTION_READY",
      strategy_version: `${prediction.strategy_count}s/${prediction.history_depth}d`,
      generated_at: new Date().toISOString(),
      locked_at: new Date().toISOString(),
    };

    const { data: saved, error: saveError } = await db
      .from("predictions")
      .upsert(payload as never, {
        onConflict: "target_date,target_session",
        ignoreDuplicates: true,
      })
      .select("*")
      .maybeSingle();
    if (saveError) syncErrors.push(`${cfg.label} prediction not saved: ${saveError.message}`);
    if (saved) predictions.unshift(saved);

    // Persist the same-target analysis snapshot (top-5 numbers, top-5
    // pairs, per-strategy breakdown) so the Analysis page and dashboard
    // read a stored figure instead of recomputing it on every page load.
    try {
      const { computeAndStoreAnalysisSnapshot } = await import("@/lib/analysis.server");
      await computeAndStoreAnalysisSnapshot(db, {
        targetDate,
        targetSession: session,
        strategies,
        history: historyBeforeTarget,
        trigger: "daily-board",
      });
    } catch (err) {
      syncErrors.push(
        `${cfg.label} analysis snapshot not saved: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /* ---- 6. persist walk-forward strategy performance ---------------- */
  const { count: perfRows } = await db
    .from("strategy_performance")
    .select("id", { count: "exact", head: true });
  if (gradedNow > 0 || !perfRows) {
    try {
      const { persistStrategyPerformance } = await import("@/lib/performance.server");
      const t = nextTarget(now);
      syncErrors.push(
        ...(await persistStrategyPerformance(db, strategies, history, {
          date: t.date,
          session: t.session,
        })),
      );
    } catch (err) {
      syncErrors.push(err instanceof Error ? err.message : String(err));
    }
  }

  /* ---- board ------------------------------------------------------ */
  const board: SessionSlot[] = SESSIONS.map((session) => {
    const cfg = SESSION_SCHEDULE[session];
    const draw = drawFor(targetDate, session) ?? null;
    const prediction = predictionFor(targetDate, session) ?? null;
    const state = sessionState({
      date: targetDate,
      session,
      hasPrediction: Boolean(prediction),
      hasResult: Boolean(draw),
      sessionVerified: draw
        ? (draw as { session_verified?: boolean }).session_verified !== false
        : false,
      graded: prediction?.status === "graded",
      now,
    });
    return {
      drawId: drawId(targetDate, session),
      session,
      label: cfg.label,
      ukTime: cfg.ukTime,
      drawAt: drawInstant(targetDate, session).toISOString(),
      state,
      blocked: Boolean(blocked[session]),
      blockedReason: blocked[session] ?? null,
      prediction: toLedger(prediction as Row | null),
      draw: toDrawRecord(draw as unknown as Row | null),
    };
  });

  const target = nextTarget(now);
  const nextLearning = buildLearning(graded, targetDate, {
    targetDate: target.date,
    targetSession: target.session,
  });
  const stillMissing: MissingSlot[] = catchup?.stillMissing ?? [];

  return {
    date: targetDate,
    ukNow: `${ukDate(now)} ${ukClock(now)}`,
    board,
    nextTarget: { ...target, drawId: drawId(target.date, target.session) },
    catchUp: catchup
      ? {
          recovered: catchup.recovered.map((m) => m.drawId),
          stillMissing: stillMissing.map((m) => m.drawId),
          overdue: stillMissing.filter((m) => m.overdue).map((m) => m.drawId),
          unresolved,
        }
      : { recovered: [], stillMissing: [], overdue: [], unresolved },
    learning: {
      sampleSize: nextLearning.sampleSize,
      recentHits: nextLearning.recentHits,
      recentMisses: nextLearning.recentMisses,
      strategyMultiplier: nextLearning.strategyMultiplier,
    },
    strategyCount: strategies.length,
    historyDepth: history.length,
    syncErrors,
  };
}

/** Read-only view of the state machine, straight from the database. */
export async function readBoard(date?: string) {
  const { serverDb } = await import("@/lib/db.server");
  const db = serverDb(true);
  const now = new Date();
  const targetDate = date ?? ukDate(now);

  const [{ data: draws }, { data: preds }] = await Promise.all([
    db.from("draws").select("*").eq("draw_date", targetDate),
    db.from("predictions").select("*").eq("target_date", targetDate),
  ]);

  return SESSIONS.map((session) => {
    const draw = (draws ?? []).find((d) => d.session === session) ?? null;
    const prediction = (preds ?? []).find((p) => p.target_session === session) ?? null;
    return {
      drawId: drawId(targetDate, session),
      session,
      label: SESSION_SCHEDULE[session].label,
      state: sessionState({
        date: targetDate,
        session,
        hasPrediction: Boolean(prediction),
        hasResult: Boolean(draw),
        sessionVerified: draw ? draw.session_verified !== false : false,
        graded: prediction?.status === "graded",
        now,
      }),
      overdue: !draw && drawOverdue(targetDate, session, now),
      prediction: toLedger(prediction as Row | null),
      draw: toDrawRecord(draw as unknown as Row | null),
    };
  });
}
