/**
 * ADDITIONAL STATISTICAL LAYER — validation & enhancement only.
 *
 * Nothing in this file touches the existing strategy formula (src/lib/engine.ts,
 * src/lib/predict.ts). It computes an independent scientific view of the same
 * history so the two can be compared in src/lib/ensemble.ts.
 */
import { SESSIONS, drawNumbers, type Draw } from "./uk49";

export const ALL_NUMBERS = Array.from({ length: 49 }, (_, i) => i + 1);

export interface NumberStat {
  n: number;
  /** Every component is normalised to 0..1 across the 49 numbers. */
  weightedFreq: number;
  ema: number;
  gap: number;
  z: number;
  bayes: number;
  markov: number;
  monteCarlo: number;
  /** Composite statistical score, 0..1. */
  score: number;
  rank: number;
  detail: {
    count: number;
    gapDraws: number | null;
    expectedGap: number;
    zRaw: number;
    posterior: number;
    markovRaw: number;
    mcProbability: number;
  };
}

export interface StatPair {
  pair: [number, number];
  count: number;
  lift: number;
  score: number;
}

export interface StatTriplet {
  triplet: [number, number, number];
  count: number;
  score: number;
}

export interface StatLayer {
  numbers: NumberStat[];
  byNumber: Record<number, NumberStat>;
  pairs: StatPair[];
  triplets: StatTriplet[];
  entropy: { value: number; max: number; ratio: number };
  sample: number;
}

const sessionIdx = (s: string) => SESSIONS.indexOf(s as (typeof SESSIONS)[number]);

/** Newest first. */
export function chronological(history: Draw[]): Draw[] {
  return [...history].sort((a, b) =>
    a.draw_date === b.draw_date
      ? sessionIdx(b.session) - sessionIdx(a.session)
      : a.draw_date < b.draw_date
        ? 1
        : -1,
  );
}

const norm = (values: Record<number, number>): Record<number, number> => {
  const list = Object.values(values);
  const min = Math.min(...list);
  const max = Math.max(...list);
  const span = max - min;
  const out: Record<number, number> = {};
  for (const n of ALL_NUMBERS) out[n] = span === 0 ? 0.5 : ((values[n] ?? 0) - min) / span;
  return out;
};

const zero = () => Object.fromEntries(ALL_NUMBERS.map((n) => [n, 0])) as Record<number, number>;

export interface StatOptions {
  /** Number of most recent draws used. */
  window?: number;
  /** Half-life (in draws) for the weighted frequency decay. */
  halfLife?: number;
  /** EMA smoothing factor. */
  alpha?: number;
  /** Monte Carlo iterations. */
  simulations?: number;
  seed?: number;
}

/** Small deterministic PRNG so Monte Carlo output is stable between renders. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

export function computeStats(history: Draw[], options: StatOptions = {}): StatLayer {
  const window = options.window ?? 260;
  const halfLife = options.halfLife ?? 60;
  const alpha = options.alpha ?? 0.08;
  const sims = options.simulations ?? 3000;

  const recent = chronological(history).slice(0, window);
  const sample = recent.length;

  const counts = zero();
  const weighted = zero();
  const lastSeen: Record<number, number | null> = Object.fromEntries(
    ALL_NUMBERS.map((n) => [n, null]),
  );

  const decay = Math.pow(0.5, 1 / halfLife);
  recent.forEach((d, i) => {
    const w = Math.pow(decay, i);
    for (const n of drawNumbers(d)) {
      counts[n] = (counts[n] ?? 0) + 1;
      weighted[n] = (weighted[n] ?? 0) + w;
      if (lastSeen[n] === null) lastSeen[n] = i;
    }
  });

  /* EMA / momentum — oldest to newest recurrence indicator. */
  const ema = zero();
  for (let i = recent.length - 1; i >= 0; i--) {
    const nums = new Set(drawNumbers(recent[i]!));
    for (const n of ALL_NUMBERS) ema[n] = (ema[n] ?? 0) * (1 - alpha) + (nums.has(n) ? alpha : 0);
  }

  /* Gap analysis. */
  const expectedGap = 49 / 6;
  const gapRaw = zero();
  for (const n of ALL_NUMBERS) {
    const g = lastSeen[n] ?? null;
    const gapDraws = g === null ? sample : g;
    // "Due" pressure, capped at 3x the expected gap.
    gapRaw[n] = Math.min(3, gapDraws / expectedGap);
  }

  /* Z-score of observed vs expected occurrences. */
  const p = 6 / 49;
  const expected = sample * p;
  const sd = Math.sqrt(Math.max(sample * p * (1 - p), 1e-9));
  const zRaw = zero();
  for (const n of ALL_NUMBERS) zRaw[n] = ((counts[n] ?? 0) - expected) / sd;

  /* Bayesian posterior mean with a Beta(6, 43) uniform-lottery prior. */
  const bayesRaw = zero();
  for (const n of ALL_NUMBERS) bayesRaw[n] = ((counts[n] ?? 0) + 6) / (sample + 49);

  /* Markov / transition — P(n appears next | numbers of the previous draw). */
  const transition: Record<number, Record<number, number>> = {};
  const fromTotal = zero();
  for (let i = recent.length - 1; i >= 1; i--) {
    const prev = drawNumbers(recent[i]!);
    const next = drawNumbers(recent[i - 1]!);
    for (const a of prev) {
      const row = (transition[a] ??= {});
      fromTotal[a] = (fromTotal[a] ?? 0) + 1;
      for (const b of next) row[b] = (row[b] ?? 0) + 1;
    }
  }
  const lastDraw = recent[0] ? drawNumbers(recent[0]) : [];
  const markovRaw = zero();
  for (const n of ALL_NUMBERS) {
    let acc = 0;
    for (const a of lastDraw) {
      const t = fromTotal[a] ?? 0;
      if (t > 0) acc += (transition[a]?.[n] ?? 0) / t;
    }
    markovRaw[n] = lastDraw.length ? acc / lastDraw.length : p;
  }

  /* Pair & triplet association (decayed co-occurrence + lift). */
  const pairCount = new Map<string, number>();
  const tripletCount = new Map<string, number>();
  recent.forEach((d) => {
    const nums = drawNumbers(d).slice().sort((a, b) => a - b);
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const k = `${nums[i]}-${nums[j]}`;
        pairCount.set(k, (pairCount.get(k) ?? 0) + 1);
        for (let m = j + 1; m < nums.length; m++) {
          const t = `${nums[i]}-${nums[j]}-${nums[m]}`;
          tripletCount.set(t, (tripletCount.get(t) ?? 0) + 1);
        }
      }
    }
  });

  const denom = Math.max(sample, 1);
  const pairs: StatPair[] = Array.from(pairCount.entries())
    .map(([k, count]) => {
      const [a, b] = k.split("-").map(Number) as [number, number];
      const pa = (counts[a] ?? 0) / denom;
      const pb = (counts[b] ?? 0) / denom;
      const lift = pa > 0 && pb > 0 ? count / denom / (pa * pb) : 0;
      return { pair: [a, b] as [number, number], count, lift, score: count * Math.max(lift, 0.01) };
    })
    .sort((x, y) => y.score - x.score);
  const maxPair = pairs[0]?.score ?? 1;
  for (const pr of pairs) pr.score = pr.score / maxPair;

  const triplets: StatTriplet[] = Array.from(tripletCount.entries())
    .map(([k, count]) => {
      const [a, b, c] = k.split("-").map(Number) as [number, number, number];
      return { triplet: [a, b, c] as [number, number, number], count, score: count };
    })
    .sort((x, y) => y.count - x.count)
    .slice(0, 40);
  const maxTrip = triplets[0]?.count ?? 1;
  for (const t of triplets) t.score = t.count / maxTrip;

  /* Monte Carlo — sample draws weighted by the blended evidence so far. */
  const preScore = zero();
  const nWeighted = norm(weighted);
  const nEma = norm(ema);
  const nBayes = norm(bayesRaw);
  const nMarkov = norm(markovRaw);
  const nGap = norm(gapRaw);
  const nZ = norm(zRaw);
  for (const n of ALL_NUMBERS)
    preScore[n] =
      0.3 * (nWeighted[n] ?? 0) +
      0.25 * (nEma[n] ?? 0) +
      0.2 * (nBayes[n] ?? 0) +
      0.15 * (nMarkov[n] ?? 0) +
      0.1 * (nGap[n] ?? 0);

  const rand = rng(options.seed ?? sample * 7919 + 13);
  const mcHits = zero();
  const weights = ALL_NUMBERS.map((n) => 0.35 + (preScore[n] ?? 0));
  for (let s = 0; s < sims; s++) {
    const pool = ALL_NUMBERS.slice();
    const w = weights.slice();
    for (let k = 0; k < 6 && pool.length; k++) {
      let total = 0;
      for (const x of w) total += x;
      let r = rand() * total;
      let idx = 0;
      while (idx < pool.length - 1 && (r -= w[idx]!) > 0) idx++;
      mcHits[pool[idx]!] = (mcHits[pool[idx]!] ?? 0) + 1;
      pool.splice(idx, 1);
      w.splice(idx, 1);
    }
  }
  const mcProb = zero();
  for (const n of ALL_NUMBERS) mcProb[n] = (mcHits[n] ?? 0) / sims;
  const nMc = norm(mcProb);

  /* Entropy / randomness of the observed distribution. */
  const totalDraws = Math.max(sample * 6, 1);
  let entropy = 0;
  for (const n of ALL_NUMBERS) {
    const prob = (counts[n] ?? 0) / totalDraws;
    if (prob > 0) entropy -= prob * Math.log2(prob);
  }
  const maxEntropy = Math.log2(49);

  const numbers: NumberStat[] = ALL_NUMBERS.map((n) => {
    const score =
      0.24 * (nWeighted[n] ?? 0) +
      0.2 * (nEma[n] ?? 0) +
      0.14 * (nBayes[n] ?? 0) +
      0.12 * (nMarkov[n] ?? 0) +
      0.12 * (nMc[n] ?? 0) +
      0.1 * (nZ[n] ?? 0) +
      0.08 * (nGap[n] ?? 0);
    return {
      n,
      weightedFreq: nWeighted[n] ?? 0,
      ema: nEma[n] ?? 0,
      gap: nGap[n] ?? 0,
      z: nZ[n] ?? 0,
      bayes: nBayes[n] ?? 0,
      markov: nMarkov[n] ?? 0,
      monteCarlo: nMc[n] ?? 0,
      score,
      rank: 0,
      detail: {
        count: counts[n] ?? 0,
        gapDraws: lastSeen[n] ?? null,
        expectedGap,
        zRaw: zRaw[n] ?? 0,
        posterior: bayesRaw[n] ?? 0,
        markovRaw: markovRaw[n] ?? 0,
        mcProbability: mcProb[n] ?? 0,
      },
    };
  }).sort((a, b) => b.score - a.score);

  numbers.forEach((s, i) => (s.rank = i + 1));
  const byNumber = Object.fromEntries(numbers.map((s) => [s.n, s])) as Record<number, NumberStat>;

  return {
    numbers,
    byNumber,
    pairs: pairs.slice(0, 40),
    triplets,
    entropy: { value: entropy, max: maxEntropy, ratio: maxEntropy ? entropy / maxEntropy : 0 },
    sample,
  };
}

export const statPairScore = (layer: StatLayer, a: number, b: number): StatPair | null => {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return layer.pairs.find((p) => p.pair[0] === lo && p.pair[1] === hi) ?? null;
};
