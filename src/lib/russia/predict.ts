import { scoreAllNumbers } from "./engine";
import type { LotteryDraw, LotteryGame, NumberScore, EnsembleWeights, RussiaPrediction, PredictionGrade } from "./types";
import { DEFAULT_WEIGHTS } from "./types";

const decade = (n: number) => Math.floor(n / 10);

/**
 * Picks exactly `count` bankers from the ranked list with a simple
 * diversification check: don't let more than 2 bankers land in the same
 * decade bucket if a same-scoring-tier alternative from another decade
 * is available. Never returns fewer than `count` — if diversification
 * can't be satisfied (small ranges), it falls back to the next-best
 * candidate regardless of decade.
 */
function selectBankers(ranked: NumberScore[], count: number): NumberScore[] {
  const chosen: NumberScore[] = [];
  const decadeUse = new Map<number, number>();

  for (const candidate of ranked) {
    if (chosen.length >= count) break;
    const d = decade(candidate.n);
    const used = decadeUse.get(d) ?? 0;
    if (used >= 2 && ranked.length - ranked.indexOf(candidate) > count - chosen.length) {
      // Skip for now — there's still enough of the list left to try a
      // more diversified pick. Comes back around in the fallback pass
      // below if nothing better turns up.
      continue;
    }
    chosen.push(candidate);
    decadeUse.set(d, used + 1);
  }

  // Fallback: if diversification skipped too aggressively and we're
  // still short, fill strictly by rank so bankers is never < count.
  if (chosen.length < count) {
    for (const candidate of ranked) {
      if (chosen.length >= count) break;
      if (!chosen.includes(candidate)) chosen.push(candidate);
    }
  }

  return chosen.slice(0, count).sort((a, b) => b.composite - a.composite);
}

function explain(score: NumberScore): string[] {
  const lines: string[] = [];
  const entries = Object.entries(score.components) as [keyof NumberScore["components"], { value: number; detail: string }][];
  const top = entries.sort((a, b) => b[1].value - a[1].value).slice(0, 3);
  const labels: Record<string, string> = {
    frequency: "Frequency",
    momentum: "Momentum",
    gap: "Gap profile",
    zScore: "Z-score",
    bayesian: "Bayesian",
    pair: "Pair strength",
    triplet: "Triplet strength",
    delayedHit: "Delayed-hit pattern",
  };
  for (const [key, comp] of top) {
    lines.push(`${labels[key]}: ${comp.detail}`);
  }
  return lines;
}

export interface BuildPredictionOptions {
  weights?: EnsembleWeights;
}

/** Builds one full prediction for a game from history strictly before the target. */
export function buildRussiaPrediction(
  game: LotteryGame,
  targetDrawNumber: number,
  history: LotteryDraw[],
  options: BuildPredictionOptions = {},
): RussiaPrediction {
  const scores = scoreAllNumbers(history, game, options.weights ?? DEFAULT_WEIGHTS);
  const bankers = selectBankers(scores, game.bankers_count);
  const bankerNumbers = new Set(bankers.map((b) => b.n));

  const remainingSlots = game.numbers_drawn - bankers.length;
  const rest = scores.filter((s) => !bankerNumbers.has(s.n)).slice(0, Math.max(0, remainingSlots));

  const predictedNumbers = [...bankers, ...rest].map((s) => s.n).sort((a, b) => a - b);

  const explanation: Record<number, string[]> = {};
  for (const b of bankers) explanation[b.n] = explain(b);

  return {
    gameId: game.id,
    targetDrawNumber,
    bankers: bankers.map((b) => b.n).sort((a, b) => a - b),
    predictedNumbers,
    scores,
    explanation,
  };
}

/** Grades a stored prediction against the actual winning numbers. */
export function gradeRussiaPrediction(prediction: RussiaPrediction, actualNumbers: number[]): PredictionGrade {
  const actual = new Set(actualNumbers);
  const matchedNumbers = prediction.predictedNumbers.filter((n) => actual.has(n));
  const bankerHits = prediction.bankers.filter((n) => actual.has(n)).length;
  return {
    actualNumbers,
    totalHits: matchedNumbers.length,
    bankerHits,
    matchedNumbers,
  };
}
