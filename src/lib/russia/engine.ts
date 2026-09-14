import type {
  LotteryDraw,
  LotteryGame,
  ComponentScore,
  NumberScore,
  EnsembleWeights,
} from "./types";
import { DEFAULT_WEIGHTS } from "./types";

/**
 * RUSSIA ENGINE — frequency, momentum, gap, z-score, Bayesian, pair,
 * triplet and delayed-hit analysis for a single game, combined into one
 * composite score per candidate number.
 *
 * Draws must already be sorted oldest → newest ascending by draw_number
 * before being passed in (callers are expected to have filtered out any
 * draw at or after the target so nothing here ever sees the future).
 */

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function frequencyAnalysis(history: LotteryDraw[], game: LotteryGame) {
  const total = history.length;
  const recentWindow = history.slice(-30);
  const counts = new Map<number, number>();
  const recentCounts = new Map<number, number>();
  for (const d of history)
    for (const n of d.winning_numbers) counts.set(n, (counts.get(n) ?? 0) + 1);
  for (const d of recentWindow)
    for (const n of d.winning_numbers) recentCounts.set(n, (recentCounts.get(n) ?? 0) + 1);

  // EMA-weighted frequency — recent draws count more, alpha tuned for a
  // ~15-draw half-life.
  const alpha = 0.12;
  const ema = new Map<number, number>();
  for (const d of history) {
    const hit = new Set(d.winning_numbers);
    for (let n = game.number_range_min; n <= game.number_range_max; n++) {
      const prev = ema.get(n) ?? 0;
      const indicator = hit.has(n) ? 1 : 0;
      ema.set(n, prev + alpha * (indicator - prev));
    }
  }

  const maxCount = Math.max(1, ...Array.from(counts.values()));
  return {
    total,
    counts,
    recentCounts,
    ema,
    score: (n: number): ComponentScore => {
      const c = counts.get(n) ?? 0;
      const r = recentCounts.get(n) ?? 0;
      const weighted = ema.get(n) ?? 0;
      // Blend: 40% historical share, 30% recent-window share, 30% EMA.
      const value = clamp01(
        0.4 * (c / maxCount) + 0.3 * (r / Math.min(30, total || 1)) + 0.3 * weighted,
      );
      return {
        value,
        detail: `${c}/${total} historical, ${r}/${Math.min(30, total)} recent`,
      };
    },
  };
}

function momentumAnalysis(history: LotteryDraw[]) {
  const recent = history.slice(-10);
  const prior = history.slice(-30, -10);
  const rate = (window: LotteryDraw[], n: number) =>
    window.length === 0
      ? 0
      : window.filter((d) => d.winning_numbers.includes(n)).length / window.length;
  return {
    score: (n: number): ComponentScore => {
      const recentRate = rate(recent, n);
      const priorRate = rate(prior, n);
      const delta = recentRate - priorRate;
      const value = clamp01(0.5 + delta); // centred at 0.5, +/- trend
      const pct = (x: number) => `${Math.round(x * 100)}%`;
      return {
        value,
        detail: `${pct(recentRate)} last 10 vs ${pct(priorRate)} prior 20 (${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}pp)`,
      };
    },
  };
}

function gapAnalysis(history: LotteryDraw[], game: LotteryGame) {
  const lastSeenIndex = new Map<number, number>();
  const gapsByNumber = new Map<number, number[]>();
  history.forEach((d, i) => {
    for (const n of d.winning_numbers) {
      const last = lastSeenIndex.get(n);
      if (last !== undefined) {
        const arr = gapsByNumber.get(n) ?? [];
        arr.push(i - last);
        gapsByNumber.set(n, arr);
      }
      lastSeenIndex.set(n, i);
    }
  });
  const total = history.length;
  const maxObservedGap = Math.max(1, ...Array.from(gapsByNumber.values()).flat(), total);

  return {
    /** Draws since this number last appeared (or since history start). */
    currentGap: (n: number) => {
      const last = lastSeenIndex.get(n);
      return last === undefined ? total : total - 1 - last;
    },
    avgGap: (n: number) => {
      const gaps = gapsByNumber.get(n);
      if (!gaps || gaps.length === 0) return total || 1;
      return gaps.reduce((a, b) => a + b, 0) / gaps.length;
    },
    maxGap: (n: number) => Math.max(0, ...(gapsByNumber.get(n) ?? [0])),
    score: (n: number): ComponentScore => {
      const cur = total === 0 ? 0 : total - 1 - (lastSeenIndex.get(n) ?? -1);
      const avg = (() => {
        const gaps = gapsByNumber.get(n);
        return gaps && gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : total || 1;
      })();
      const deviation = avg > 0 ? (cur - avg) / avg : 0;
      // Overdue is informational, not a "due" guarantee — score peaks
      // gently around the average gap and tapers off far past it,
      // rather than rewarding "the longer overdue the better".
      const value = clamp01(1 - Math.abs(deviation) * 0.6);
      const overdue = cur > avg;
      return {
        value,
        detail: `current gap ${cur}, avg ${avg.toFixed(1)}, max ${Math.max(0, ...(gapsByNumber.get(n) ?? [0]))}${overdue ? " (overdue vs its own average — not a guarantee)" : ""}`,
      };
    },
    _maxObservedGap: maxObservedGap,
  };
}

function zScoreAnalysis(history: LotteryDraw[], game: LotteryGame) {
  const total = history.length;
  const range = game.number_range_max - game.number_range_min + 1;
  const p = game.numbers_drawn / range;
  const expected = total * p;
  const variance = Math.max(0.0001, total * p * (1 - p));
  const sd = Math.sqrt(variance);
  const counts = new Map<number, number>();
  for (const d of history)
    for (const n of d.winning_numbers) counts.set(n, (counts.get(n) ?? 0) + 1);

  return {
    score: (n: number): ComponentScore => {
      const observed = counts.get(n) ?? 0;
      const z = (observed - expected) / sd;
      // Map z in roughly [-2, 2] to [0, 1].
      const value = clamp01(0.5 + z / 4);
      return {
        value,
        detail: `z=${z.toFixed(2)} (${observed} seen vs ${expected.toFixed(1)} expected)`,
      };
    },
  };
}

function bayesianAnalysis(history: LotteryDraw[], game: LotteryGame) {
  const total = history.length;
  const range = game.number_range_max - game.number_range_min + 1;
  const baseline = game.numbers_drawn / range;
  // Beta prior centred on the uniform baseline, modest strength (20 draws
  // worth) so small samples don't swing wildly.
  const priorStrength = 20;
  const alpha0 = baseline * priorStrength;
  const beta0 = (1 - baseline) * priorStrength;
  const counts = new Map<number, number>();
  for (const d of history)
    for (const n of d.winning_numbers) counts.set(n, (counts.get(n) ?? 0) + 1);

  return {
    score: (n: number): ComponentScore => {
      const hits = counts.get(n) ?? 0;
      const misses = total - hits;
      const posterior = (hits + alpha0) / (hits + alpha0 + misses + beta0);
      // Normalise against the baseline so "at baseline" sits at 0.5.
      const value = clamp01(0.5 + (posterior - baseline) / (baseline * 2 || 1));
      return {
        value,
        detail: `posterior p=${posterior.toFixed(3)} vs baseline ${baseline.toFixed(3)}`,
      };
    },
  };
}

function pairAnalysis(history: LotteryDraw[]) {
  const pairCounts = new Map<string, number>();
  const partnerTotals = new Map<number, number>();
  for (const d of history) {
    const nums = d.winning_numbers;
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const x = nums[i]!;
        const y = nums[j]!;
        const [a, b] = x < y ? [x, y] : [y, x];
        const key = `${a}-${b}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        partnerTotals.set(a, (partnerTotals.get(a) ?? 0) + 1);
        partnerTotals.set(b, (partnerTotals.get(b) ?? 0) + 1);
      }
    }
  }
  const maxPartnerTotal = Math.max(1, ...Array.from(partnerTotals.values()));
  return {
    pairCounts,
    strongestPartner: (n: number): [number, number] | null => {
      let best: number | null = null;
      let bestCount = 0;
      for (const [key, count] of pairCounts) {
        const [a, b] = key.split("-").map(Number) as [number, number];
        if (a === n || b === n) {
          if (count > bestCount) {
            bestCount = count;
            best = a === n ? b : a;
          }
        }
      }
      return best === null ? null : [best, bestCount];
    },
    score: (n: number): ComponentScore => {
      const total = partnerTotals.get(n) ?? 0;
      const value = clamp01(total / maxPartnerTotal);
      const partner = (() => {
        let best: number | null = null;
        let bestCount = 0;
        for (const [key, count] of pairCounts) {
          const [a, b] = key.split("-").map(Number) as [number, number];
          if ((a === n || b === n) && count > bestCount) {
            bestCount = count;
            best = a === n ? b : a;
          }
        }
        return best;
      })();
      return {
        value,
        detail:
          partner !== null
            ? `strongest partner ${partner} (${
                pairCounts.get((n < partner ? [n, partner] : [partner, n]).join("-")) ?? 0
              }x together)`
            : "no repeated pairs yet",
      };
    },
  };
}

function tripletAnalysis(history: LotteryDraw[]) {
  const tripletCounts = new Map<string, number>();
  const involvedTotals = new Map<number, number>();
  for (const d of history) {
    const nums = [...d.winning_numbers].sort((a, b) => a - b);
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        for (let k = j + 1; k < nums.length; k++) {
          const a = nums[i]!;
          const b = nums[j]!;
          const c = nums[k]!;
          const key = `${a}-${b}-${c}`;
          tripletCounts.set(key, (tripletCounts.get(key) ?? 0) + 1);
          involvedTotals.set(a, (involvedTotals.get(a) ?? 0) + 1);
          involvedTotals.set(b, (involvedTotals.get(b) ?? 0) + 1);
          involvedTotals.set(c, (involvedTotals.get(c) ?? 0) + 1);
        }
      }
    }
  }
  const maxTotal = Math.max(1, ...Array.from(involvedTotals.values()));
  return {
    tripletCounts,
    score: (n: number): ComponentScore => {
      const total = involvedTotals.get(n) ?? 0;
      const value = clamp01(total / maxTotal);
      return { value, detail: `appears in ${total} repeated triplet(s) historically` };
    },
  };
}

/**
 * Delayed-hit analysis: for each number, build the distribution of
 * "draws until it repeated" after each of its own past appearances, then
 * score how well the number's *current* gap matches a historically
 * common recurrence delay for that same number. Used only as one signal
 * among many — never a standalone "it's due" rule.
 */
function delayedHitAnalysis(history: LotteryDraw[]) {
  const appearIndices = new Map<number, number[]>();
  history.forEach((d, i) => {
    for (const n of d.winning_numbers) {
      const arr = appearIndices.get(n) ?? [];
      arr.push(i);
      appearIndices.set(n, arr);
    }
  });
  const delayCounts = new Map<number, Map<number, number>>();
  for (const [n, idxs] of appearIndices) {
    const delays = new Map<number, number>();
    for (let i = 1; i < idxs.length; i++) {
      const delay = idxs[i]! - idxs[i - 1]!;
      delays.set(delay, (delays.get(delay) ?? 0) + 1);
    }
    delayCounts.set(n, delays);
  }
  const total = history.length;

  return {
    score: (n: number, currentGap: number): ComponentScore => {
      const delays = delayCounts.get(n);
      if (!delays || delays.size === 0) return { value: 0.5, detail: "no recurrence history yet" };
      const totalOccurrences = Array.from(delays.values()).reduce((a, b) => a + b, 0);
      // Probability mass at exactly currentGap, plus a little credit for
      // the neighbouring delay values (+/-1 draw), as a fraction of this
      // number's own recurrence history.
      const mass =
        (delays.get(currentGap) ?? 0) +
        0.5 * (delays.get(currentGap - 1) ?? 0) +
        0.5 * (delays.get(currentGap + 1) ?? 0);
      const value = clamp01(mass / Math.max(1, totalOccurrences));
      const commonDelay = Array.from(delays.entries()).sort((a, b) => b[1] - a[1])[0];
      return {
        value,
        detail: `most common repeat delay ${commonDelay?.[0] ?? "n/a"} draws (seen ${commonDelay?.[1] ?? 0}x of ${totalOccurrences}); current gap ${currentGap}`,
      };
    },
    _total: total,
  };
}

export interface ScoringLayers {
  frequency: ReturnType<typeof frequencyAnalysis>;
  momentum: ReturnType<typeof momentumAnalysis>;
  gap: ReturnType<typeof gapAnalysis>;
  zScore: ReturnType<typeof zScoreAnalysis>;
  bayesian: ReturnType<typeof bayesianAnalysis>;
  pair: ReturnType<typeof pairAnalysis>;
  triplet: ReturnType<typeof tripletAnalysis>;
  delayedHit: ReturnType<typeof delayedHitAnalysis>;
}

export function buildScoringLayers(history: LotteryDraw[], game: LotteryGame): ScoringLayers {
  return {
    frequency: frequencyAnalysis(history, game),
    momentum: momentumAnalysis(history),
    gap: gapAnalysis(history, game),
    zScore: zScoreAnalysis(history, game),
    bayesian: bayesianAnalysis(history, game),
    pair: pairAnalysis(history),
    triplet: tripletAnalysis(history),
    delayedHit: delayedHitAnalysis(history),
  };
}

/** Composite-scores every eligible number in the game's range. */
export function scoreAllNumbers(
  history: LotteryDraw[],
  game: LotteryGame,
  weights: EnsembleWeights = DEFAULT_WEIGHTS,
): NumberScore[] {
  const layers = buildScoringLayers(history, game);
  const out: NumberScore[] = [];
  for (let n = game.number_range_min; n <= game.number_range_max; n++) {
    const currentGap = layers.gap.currentGap(n);
    const components = {
      frequency: layers.frequency.score(n),
      momentum: layers.momentum.score(n),
      gap: layers.gap.score(n),
      zScore: layers.zScore.score(n),
      bayesian: layers.bayesian.score(n),
      pair: layers.pair.score(n),
      triplet: layers.triplet.score(n),
      delayedHit: layers.delayedHit.score(n, currentGap),
    };
    const composite =
      weights.frequency * components.frequency.value +
      weights.momentum * components.momentum.value +
      weights.gap * components.gap.value +
      weights.zScore * components.zScore.value +
      weights.bayesian * components.bayesian.value +
      weights.pair * components.pair.value +
      weights.triplet * components.triplet.value +
      weights.delayedHit * components.delayedHit.value;
    out.push({ n, composite, components });
  }
  return out.sort((a, b) => b.composite - a.composite);
}
