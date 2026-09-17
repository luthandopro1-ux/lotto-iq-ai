import type { Db } from "@/lib/db.server";
import { fetchRussiaLatest } from "./provider.server";
import { addDrawAndAdvance, getGameByCode } from "./service.server";

export interface RussiaSyncSummary {
  gameCode: string;
  status: "ok" | "failed" | "retired";
  found: number;
  inserted: number;
  skipped: number;
  errors: string[];
}

export async function syncRussiaGame(db: Db, gameCode: string): Promise<RussiaSyncSummary> {
  const game = await getGameByCode(db, gameCode);
  const provider = gameCode === "ru_5_50" ? "stoloto-archive-retired" : `stoloto-${gameCode}`;
  const { data: run } = await db
    .from("lottery_ingest_runs")
    .insert({ game_id: game.id, provider, status: "running" })
    .select("id")
    .single();
  if (!game.active) {
    if (run?.id) {
      await db
        .from("lottery_ingest_runs")
        .update({ status: "retired", finished_at: new Date().toISOString() })
        .eq("id", run.id);
    }
    return {
      gameCode,
      status: "retired",
      found: 0,
      inserted: 0,
      skipped: 0,
      errors: ["Game is retired; no current results exist."],
    };
  }

  try {
    const remote = await fetchRussiaLatest(game);
    const numbers = remote.map((draw) => draw.drawNumber);
    const { data: existing } = numbers.length
      ? await db
          .from("lottery_draws")
          .select("draw_number")
          .eq("game_id", game.id)
          .in("draw_number", numbers)
      : { data: [] };
    const have = new Set((existing ?? []).map((row) => Number(row.draw_number)));
    let inserted = 0;
    for (const draw of [...remote].sort((a, b) => a.drawNumber - b.drawNumber)) {
      if (have.has(draw.drawNumber)) continue;
      await addDrawAndAdvance(db, {
        gameCode,
        drawDate: draw.drawDate,
        drawNumber: draw.drawNumber,
        winningNumbers: draw.winningNumbers,
        source: draw.source,
      });
      inserted += 1;
    }
    if (run?.id) {
      await db
        .from("lottery_ingest_runs")
        .update({
          status: "ok",
          finished_at: new Date().toISOString(),
          found: remote.length,
          inserted,
          skipped: remote.length - inserted,
          detail: { source: provider } as never,
        })
        .eq("id", run.id);
    }
    return {
      gameCode,
      status: "ok",
      found: remote.length,
      inserted,
      skipped: remote.length - inserted,
      errors: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (run?.id) {
      await db
        .from("lottery_ingest_runs")
        .update({ status: "failed", finished_at: new Date().toISOString(), error: message })
        .eq("id", run.id);
    }
    return { gameCode, status: "failed", found: 0, inserted: 0, skipped: 0, errors: [message] };
  }
}

export async function syncAllRussiaGames(db: Db): Promise<RussiaSyncSummary[]> {
  return Promise.all(
    ["ru_5_50", "ru_6_45", "ru_7_49"].map((gameCode) => syncRussiaGame(db, gameCode)),
  );
}
