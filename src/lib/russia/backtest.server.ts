import { buildRussiaPrediction, gradeRussiaPrediction } from "./predict";
import { getGameByCode, getHistory } from "./service.server";
import type { LotteryDraw, LotteryGame } from "./types";
import type { Db } from "@/lib/db.server";

export interface RussiaBacktestMetrics {
  tests: number;
  totalHits: number;
  avgHits: number;
  bestHits: number;
  worstHits: number;
  bankerHitRate: number;
  avgBankerHits: number;
  totalBankerHits: number;
}

export interface RussiaBacktestResults {
  generatedAt: string;
  drawsTested: number;
  metrics: RussiaBacktestMetrics;
  timeline: { drawNumber: number; date: string; hits: number; bankerHits: number }[];
}

export interface RussiaBacktestRow {
  id: string;
  game_id: string;
  label: string | null;
  date_from: string;
  date_to: string;
  results: RussiaBacktestResults;
  created_at: string;
}

const MIN_HISTORY = 15;

export function evaluateRussiaBacktest(
  game: LotteryGame,
  history: LotteryDraw[],
  dateFrom: string,
  dateTo: string,
): RussiaBacktestResults {
  const chronological = [...history].sort((a, b) => a.draw_number - b.draw_number);
  const targets = chronological.filter((d) => d.draw_date >= dateFrom && d.draw_date <= dateTo);

  let totalHits = 0;
  let bestHits = 0;
  let worstHits = Infinity;
  let hitDraws = 0;
  let totalBankerHits = 0;
  let tests = 0;
  const timeline: RussiaBacktestResults["timeline"] = [];

  for (const target of targets) {
    const before = chronological.filter((d) => d.draw_number < target.draw_number);
    if (before.length < MIN_HISTORY) continue;

    const prediction = buildRussiaPrediction(game, target.draw_number, before);
    const grade = gradeRussiaPrediction(prediction, target.winning_numbers);

    totalHits += grade.totalHits;
    bestHits = Math.max(bestHits, grade.totalHits);
    worstHits = Math.min(worstHits, grade.totalHits);
    if (grade.bankerHits > 0) hitDraws += 1;
    totalBankerHits += grade.bankerHits;
    tests += 1;

    timeline.push({
      drawNumber: target.draw_number,
      date: target.draw_date,
      hits: grade.totalHits,
      bankerHits: grade.bankerHits,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    drawsTested: tests,
    metrics: {
      tests,
      totalHits,
      avgHits: tests ? totalHits / tests : 0,
      bestHits: tests ? bestHits : 0,
      worstHits: tests ? worstHits : 0,
      bankerHitRate: tests ? (hitDraws / tests) * 100 : 0,
      avgBankerHits: tests ? totalBankerHits / tests : 0,
      totalBankerHits,
    },
    timeline: timeline.slice(-60),
  };
}

export async function runAndSaveRussiaBacktest(
  db: Db,
  gameCode: string,
  dateFrom: string,
  dateTo: string,
  label?: string,
): Promise<RussiaBacktestRow> {
  const game = await getGameByCode(db, gameCode);
  const history = await getHistory(db, game.id);
  if (history.length === 0)
    throw new Error(`No ${game.game_name} draws yet — add some history first.`);

  const results = evaluateRussiaBacktest(game, history, dateFrom, dateTo);
  const { data, error } = await db
    .from("lottery_backtests")
    .insert({
      game_id: game.id,
      label: label ?? null,
      date_from: dateFrom,
      date_to: dateTo,
      results: results as never,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Backtest could not be saved.");
  return data as unknown as RussiaBacktestRow;
}

export async function listRussiaBacktests(db: Db, gameCode: string): Promise<RussiaBacktestRow[]> {
  const game = await getGameByCode(db, gameCode);
  const { data } = await db
    .from("lottery_backtests")
    .select("*")
    .eq("game_id", game.id)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as unknown as RussiaBacktestRow[];
}
