import { buildRussiaPrediction, gradeRussiaPrediction } from "./predict";
import type { LotteryDraw, LotteryGame, RussiaPrediction } from "./types";
import type { Db } from "@/lib/db.server";
import type { Json } from "@/integrations/supabase/types";

export async function getGameByCode(db: Db, code: string): Promise<LotteryGame> {
  const { data, error } = await db.from("lottery_games").select("*").eq("code", code).single();
  if (error || !data) throw new Error(`Unknown game: ${code}`);
  return data as LotteryGame;
}

export async function listGames(db: Db): Promise<LotteryGame[]> {
  const { data, error } = await db.from("lottery_games").select("*").order("number_range_max");
  if (error) throw new Error(error.message);
  return (data ?? []) as LotteryGame[];
}

/** Ascending (oldest → newest) draw history for a game, capped for performance. */
export async function getHistory(db: Db, gameId: string, limit = 2000): Promise<LotteryDraw[]> {
  const { data, error } = await db
    .from("lottery_draws")
    .select("*")
    .eq("game_id", gameId)
    .order("draw_number", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as LotteryDraw[]).slice().reverse();
}

export interface GameState {
  game: LotteryGame;
  recentDraws: LotteryDraw[];
  pendingPrediction: (RussiaPrediction & { id: string; createdAt: string }) | null;
  lastResult: {
    prediction: RussiaPrediction & { id: string };
    totalHits: number;
    bankerHits: number;
    matchedNumbers: number[];
    actualNumbers: number[];
  } | null;
}

interface PredictionRow {
  id: string;
  created_at: string;
  game_id: string;
  target_draw_number: number;
  bankers: number[];
  predicted_numbers: number[];
  strategy_scores: Json;
  explanation: Json;
}

function rowToPrediction(row: PredictionRow): RussiaPrediction & { id: string; createdAt: string } {
  const strategyScores = row.strategy_scores as unknown as {
    scores?: RussiaPrediction["scores"];
  } | null;
  return {
    id: row.id,
    createdAt: row.created_at,
    gameId: row.game_id,
    targetDrawNumber: row.target_draw_number,
    bankers: row.bankers,
    predictedNumbers: row.predicted_numbers,
    scores: strategyScores?.scores ?? [],
    explanation: (row.explanation as unknown as RussiaPrediction["explanation"]) ?? {},
  };
}

export async function getGameState(db: Db, gameCode: string): Promise<GameState> {
  const game = await getGameByCode(db, gameCode);
  const history = await getHistory(db, game.id, 60);

  const { data: pendingRows } = await db
    .from("lottery_predictions")
    .select("*")
    .eq("game_id", game.id)
    .eq("status", "pending")
    .order("target_draw_number", { ascending: false })
    .limit(1);
  const pendingPrediction = pendingRows?.[0] ? rowToPrediction(pendingRows[0]) : null;

  const { data: gradedRows } = await db
    .from("lottery_predictions")
    .select("*, lottery_prediction_results(*)")
    .eq("game_id", game.id)
    .eq("status", "graded")
    .order("target_draw_number", { ascending: false })
    .limit(1);
  const gradedRow = gradedRows?.[0];
  const lastResult = gradedRow?.lottery_prediction_results
    ? {
        prediction: rowToPrediction(gradedRow),
        totalHits: gradedRow.lottery_prediction_results.total_hits,
        bankerHits: gradedRow.lottery_prediction_results.banker_hits,
        matchedNumbers: gradedRow.lottery_prediction_results.matched_numbers,
        actualNumbers: gradedRow.lottery_prediction_results.actual_numbers,
      }
    : null;

  return { game, recentDraws: history.slice(-20).reverse(), pendingPrediction, lastResult };
}

async function storePrediction(db: Db, prediction: RussiaPrediction) {
  const payload = {
    game_id: prediction.gameId,
    target_draw_number: prediction.targetDrawNumber,
    bankers: prediction.bankers,
    predicted_numbers: prediction.predictedNumbers,
    strategy_scores: { scores: prediction.scores } as never,
    composite_score: Object.fromEntries(
      prediction.scores.slice(0, 10).map((s) => [s.n, s.composite]),
    ) as never,
    explanation: prediction.explanation as never,
    status: "pending",
  };
  const { error } = await db
    .from("lottery_predictions")
    .upsert(payload, { onConflict: "game_id,target_draw_number", ignoreDuplicates: true });
  if (error) throw new Error(`Prediction not saved: ${error.message}`);
}

export interface AddDrawInput {
  gameCode: string;
  drawDate: string;
  drawNumber: number;
  winningNumbers: number[];
  source?: string;
}

export interface AddDrawResult {
  draw: LotteryDraw;
  graded: { totalHits: number; bankerHits: number; matchedNumbers: number[] } | null;
  nextPrediction: RussiaPrediction;
}

/**
 * The full pipeline described in the spec: validate → store → grade the
 * outstanding prediction (if the draw matches one) → generate the next
 * prediction with fresh bankers. Never invents a result — this only runs
 * on numbers the caller (a human, for now — see DEPLOY notes) actually
 * supplies.
 */
export async function addDrawAndAdvance(db: Db, input: AddDrawInput): Promise<AddDrawResult> {
  const game = await getGameByCode(db, input.gameCode);

  const numbers = Array.from(new Set(input.winningNumbers)).sort((a, b) => a - b);
  if (numbers.length !== game.numbers_drawn) {
    throw new Error(`${game.game_name} needs exactly ${game.numbers_drawn} distinct numbers.`);
  }
  for (const n of numbers) {
    if (n < game.number_range_min || n > game.number_range_max) {
      throw new Error(
        `${n} is outside ${game.game_name}'s range (${game.number_range_min}-${game.number_range_max}).`,
      );
    }
  }

  const { data: drawRow, error: drawError } = await db
    .from("lottery_draws")
    .insert({
      game_id: game.id,
      draw_date: input.drawDate,
      draw_number: input.drawNumber,
      winning_numbers: numbers,
      source: input.source ?? "manual",
    })
    .select("*")
    .single();
  if (drawError || !drawRow) throw new Error(drawError?.message ?? "Draw could not be saved.");
  const draw = drawRow as LotteryDraw;

  // Grade whatever prediction was outstanding for this draw number, if any.
  let graded: AddDrawResult["graded"] = null;
  const { data: pendingRows } = await db
    .from("lottery_predictions")
    .select("*")
    .eq("game_id", game.id)
    .eq("target_draw_number", input.drawNumber)
    .eq("status", "pending")
    .limit(1);
  const pendingRow = pendingRows?.[0];
  if (pendingRow) {
    const asPrediction = rowToPrediction(pendingRow);
    const gradeResult = gradeRussiaPrediction(asPrediction, numbers);
    await db.from("lottery_prediction_results").insert({
      prediction_id: pendingRow.id,
      actual_numbers: gradeResult.actualNumbers,
      total_hits: gradeResult.totalHits,
      banker_hits: gradeResult.bankerHits,
      matched_numbers: gradeResult.matchedNumbers,
    });
    await db
      .from("lottery_predictions")
      .update({ status: "graded", draw_id: draw.id })
      .eq("id", pendingRow.id);
    graded = {
      totalHits: gradeResult.totalHits,
      bankerHits: gradeResult.bankerHits,
      matchedNumbers: gradeResult.matchedNumbers,
    };
  }

  // Generate the next prediction from history including this draw.
  const history = await getHistory(db, game.id);
  const nextTarget = input.drawNumber + 1;
  const nextPrediction = buildRussiaPrediction(game, nextTarget, history);
  await storePrediction(db, nextPrediction);

  return { draw, graded, nextPrediction };
}

/** Ensures a pending prediction exists for the next draw, without needing a new result first (first run / bootstrap). */
export async function ensurePendingPrediction(
  db: Db,
  gameCode: string,
): Promise<RussiaPrediction | null> {
  const game = await getGameByCode(db, gameCode);
  const { data: pendingRows } = await db
    .from("lottery_predictions")
    .select("id")
    .eq("game_id", game.id)
    .eq("status", "pending")
    .limit(1);
  if (pendingRows && pendingRows.length > 0) return null;

  const history = await getHistory(db, game.id);
  if (history.length === 0) return null;
  const nextTarget = Math.max(...history.map((d) => d.draw_number)) + 1;
  const prediction = buildRussiaPrediction(game, nextTarget, history);
  await storePrediction(db, prediction);
  return prediction;
}
