import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-guard";

interface GradedPredictionRow {
  target_draw_number: number;
  lottery_prediction_results: { total_hits: number; banker_hits: number } | null;
}

const GameCodeInput = z.object({ gameCode: z.enum(["ru_5_50", "ru_6_45", "ru_7_49"]) });

export const listRussiaGames = createServerFn({ method: "GET" }).handler(async () => {
  const { serverDb } = await import("@/lib/db.server");
  const { listGames } = await import("@/lib/russia/service.server");
  return listGames(serverDb());
});

export const getRussiaGameState = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => GameCodeInput.parse(input))
  .handler(async ({ data }) => {
    const { serverDb } = await import("@/lib/db.server");
    const { getGameState, ensurePendingPrediction } = await import("@/lib/russia/service.server");
    const db = serverDb();
    // Bootstrap: if history exists but nothing is pending yet (first run
    // after seeding draws), generate one instead of showing an empty page.
    await ensurePendingPrediction(db, data.gameCode).catch(() => null);
    return getGameState(db, data.gameCode);
  });

const AddDrawInput = GameCodeInput.extend({
  drawDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  drawNumber: z.number().int().positive(),
  winningNumbers: z.array(z.number().int().positive()).min(1),
});

export const addRussiaDraw = createServerFn({ method: "POST" })
  .middleware([adminGuard])
  .inputValidator((input: unknown) => AddDrawInput.parse(input))
  .handler(async ({ data }) => {
    const { serverDb } = await import("@/lib/db.server");
    const { addDrawAndAdvance } = await import("@/lib/russia/service.server");
    return addDrawAndAdvance(serverDb(), {
      gameCode: data.gameCode,
      drawDate: data.drawDate,
      drawNumber: data.drawNumber,
      winningNumbers: data.winningNumbers,
    });
  });

const DashboardInput = GameCodeInput;

export const getRussiaDashboard = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => DashboardInput.parse(input))
  .handler(async ({ data }) => {
    const { serverDb } = await import("@/lib/db.server");
    const { getGameByCode, getHistory } = await import("@/lib/russia/service.server");
    const { scoreAllNumbers } = await import("@/lib/russia/engine");
    const db = serverDb();
    const game = await getGameByCode(db, data.gameCode);
    const history = await getHistory(db, game.id);

    const scores = history.length > 0 ? scoreAllNumbers(history, game) : [];
    const hot = scores.slice(0, 10).map((s) => ({ n: s.n, score: s.composite }));
    const cold = [...scores]
      .reverse()
      .slice(0, 10)
      .map((s) => ({ n: s.n, score: s.composite }));

    // Recent prediction performance summary.
    const { data: gradedRows } = await db
      .from("lottery_predictions")
      .select("*, lottery_prediction_results(*)")
      .eq("game_id", game.id)
      .eq("status", "graded")
      .order("target_draw_number", { ascending: false })
      .limit(20);

    const graded = ((gradedRows ?? []) as GradedPredictionRow[]).filter(
      (r) => r.lottery_prediction_results,
    );
    const totalHits = graded.reduce(
      (a, r) => a + (r.lottery_prediction_results?.total_hits ?? 0),
      0,
    );
    const totalBankerHits = graded.reduce(
      (a, r) => a + (r.lottery_prediction_results?.banker_hits ?? 0),
      0,
    );
    const drawsWithBankerHit = graded.filter(
      (r) => (r.lottery_prediction_results?.banker_hits ?? 0) > 0,
    ).length;

    return {
      game,
      drawsRecorded: history.length,
      hot,
      cold,
      performance: {
        gradedCount: graded.length,
        avgHits: graded.length ? totalHits / graded.length : 0,
        avgBankerHits: graded.length ? totalBankerHits / graded.length : 0,
        bankerHitRate: graded.length ? (drawsWithBankerHit / graded.length) * 100 : 0,
        recent: graded.slice(0, 10).map((r) => ({
          targetDrawNumber: r.target_draw_number,
          totalHits: r.lottery_prediction_results?.total_hits ?? 0,
          bankerHits: r.lottery_prediction_results?.banker_hits ?? 0,
        })),
      },
    };
  });

const MAX_RUSSIA_BACKTEST_DAYS = 180;

const RunBacktestInput = GameCodeInput.extend({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().max(120).optional(),
}).refine(
  (v) => {
    const days = (Date.parse(v.dateTo) - Date.parse(v.dateFrom)) / 86_400_000;
    return days >= 0 && days <= MAX_RUSSIA_BACKTEST_DAYS;
  },
  {
    message: `Backtest range can't exceed ${MAX_RUSSIA_BACKTEST_DAYS} days per run — Cloudflare Workers meter CPU time per request. Run it in shorter windows instead.`,
  },
);

export const runRussiaBacktest = createServerFn({ method: "POST" })
  .middleware([adminGuard])
  .inputValidator((input: unknown) => RunBacktestInput.parse(input))
  .handler(async ({ data }) => {
    const { serverDb } = await import("@/lib/db.server");
    const { runAndSaveRussiaBacktest } = await import("@/lib/russia/backtest.server");
    return runAndSaveRussiaBacktest(
      serverDb(),
      data.gameCode,
      data.dateFrom,
      data.dateTo,
      data.label,
    );
  });

export const listRussiaBacktestsFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => GameCodeInput.parse(input))
  .handler(async ({ data }) => {
    const { serverDb } = await import("@/lib/db.server");
    const { listRussiaBacktests } = await import("@/lib/russia/backtest.server");
    return listRussiaBacktests(serverDb(), data.gameCode);
  });
