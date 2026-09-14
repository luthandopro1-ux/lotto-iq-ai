import { runAnalysis, type ScoredNumber } from "./engine";
import { SESSIONS, drawNumbers, type Draw, type SessionKey, type Strategy } from "./uk49";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface PickedNumber {
  n: number;
  /** Names of the strategies that produced this number. */
  strategies: string[];
  strategyIds: string[];
  score: number;
}

export interface PredictionRow {
  banker: PickedNumber;
  pair: [PickedNumber, PickedNumber];
  bonus: PickedNumber;
}

export interface Prediction {
  target_date: string;
  target_session: SessionKey;
  bankers: PickedNumber[];
  rows: PredictionRow[];
  pool: PickedNumber[];
  strategy_count: number;
  history_depth: number;
}

export interface RowGrade {
  bankerHit: boolean;
  pairHits: [boolean, boolean];
  pairFullHit: boolean;
  bonusHit: boolean;
}

export interface Grading {
  actual: number[];
  booster: number | null;
  rows: RowGrade[];
  poolHits: number[];
  poolMisses: number[];
  /** hits / misses per strategy id, attributed through the numbers it produced. */
  strategies: Record<string, { name: string; hits: number; misses: number }>;
  matched: number;
}

export interface Learning {
  /** Additive score adjustment per number, from recent hits and misses. */
  numberAdjust: Record<number, number>;
  /** Multiplier per strategy id, from its recent accuracy. */
  strategyMultiplier: Record<string, number>;
  /** Numbers predicted and missed in earlier sessions of the running day. */
  recentMisses: number[];
  recentHits: number[];
  sampleSize: number;
}

export const emptyLearning = (): Learning => ({
  numberAdjust: {},
  strategyMultiplier: {},
  recentMisses: [],
  recentHits: [],
  sampleSize: 0,
});

/* ------------------------------------------------------------------ */
/* Daily sequence helpers — UK49s runs 4 draws a day                    */
/* ------------------------------------------------------------------ */

export const sessionIndex = (s: SessionKey) => SESSIONS.indexOf(s);

/** Every session of the day strictly before `session`. */
export const sessionsBefore = (session: SessionKey): SessionKey[] =>
  SESSIONS.slice(0, sessionIndex(session));

/**
 * The full ordered sequence of draws leading into a target draw:
 * every completed draw of the target day, then the previous days'
 * four-draw blocks, newest first.
 */
export function dailySequence(
  history: Draw[],
  targetDate: string,
  targetSession: SessionKey,
  days = 3,
): Draw[] {
  const key = (d: Draw) => `${d.draw_date}#${sessionIndex(d.session)}`;
  const cutoff = `${targetDate}#${sessionIndex(targetSession)}`;
  const earliest = new Date(`${targetDate}T00:00:00Z`);
  earliest.setUTCDate(earliest.getUTCDate() - days);
  const from = earliest.toISOString().slice(0, 10);

  return history
    .filter((d) => d.draw_date >= from && key(d) < cutoff)
    .sort((a, b) => (key(a) < key(b) ? 1 : -1));
}

/* ------------------------------------------------------------------ */
/* Learning from graded predictions                                    */
/* ------------------------------------------------------------------ */

export interface GradedRecord {
  target_date: string;
  target_session: SessionKey;
  grading: Grading | null;
}

/**
 * Turns recent graded predictions into score adjustments.
 * Misses are penalised, hits reinforced, and each strategy gets an
 * accuracy multiplier — this is what makes the system learn across the
 * four daily draws.
 */
export function buildLearning(records: GradedRecord[], sameDay?: string): Learning {
  const learning = emptyLearning();
  const strategyTally: Record<string, { hits: number; misses: number }> = {};

  records.forEach((rec, idx) => {
    const g = rec.grading;
    if (!g) return;
    learning.sampleSize += 1;
    // Most recent record carries the most weight.
    const recency = 1 / (1 + idx * 0.5);
    const dayBoost = sameDay && rec.target_date === sameDay ? 1.6 : 1;
    const w = recency * dayBoost;

    for (const n of g.poolHits) {
      learning.numberAdjust[n] = (learning.numberAdjust[n] ?? 0) + 0.9 * w;
      if (!learning.recentHits.includes(n)) learning.recentHits.push(n);
    }
    for (const n of g.poolMisses) {
      learning.numberAdjust[n] = (learning.numberAdjust[n] ?? 0) - 0.6 * w;
      if (!learning.recentMisses.includes(n)) learning.recentMisses.push(n);
    }
    for (const [id, s] of Object.entries(g.strategies ?? {})) {
      const t = (strategyTally[id] ??= { hits: 0, misses: 0 });
      t.hits += s.hits;
      t.misses += s.misses;
    }
  });

  for (const [id, t] of Object.entries(strategyTally)) {
    const total = t.hits + t.misses;
    if (total === 0) continue;
    const accuracy = t.hits / total;
    // 0 % accuracy -> 0.6x, ~35 % -> ~1.0x, 100 % -> 1.7x
    learning.strategyMultiplier[id] = Math.min(1.7, Math.max(0.6, 0.6 + accuracy * 1.1));
  }

  return learning;
}

/* ------------------------------------------------------------------ */
/* Prediction builder                                                  */
/* ------------------------------------------------------------------ */

const pick = (s: ScoredNumber, score: number): PickedNumber => ({
  n: s.number,
  strategies: Array.from(new Set(s.hits.map((h) => h.strategy))),
  strategyIds: Array.from(new Set(s.hits.map((h) => h.strategyId))),
  score: Number(score.toFixed(2)),
});

export interface BuildOptions {
  rows?: number;
  learning?: Learning;
}

/**
 * Runs every active strategy over the full daily sequence and turns the
 * ranked pool into the Banker / Pairs / Bonus chart.
 */
export function buildPrediction(
  strategies: Strategy[],
  args: {
    targetDate: string;
    targetSession: SessionKey;
    history: Draw[];
  },
  options: BuildOptions = {},
): Prediction {
  const rowCount = options.rows ?? 7;
  const learning = options.learning ?? emptyLearning();

  const sequence = dailySequence(args.history, args.targetDate, args.targetSession);
  const before = args.history
    .filter(
      (d) =>
        d.draw_date < args.targetDate ||
        (d.draw_date === args.targetDate &&
          sessionIndex(d.session) < sessionIndex(args.targetSession)),
    )
    .sort((a, b) =>
      a.draw_date === b.draw_date
        ? sessionIndex(b.session) - sessionIndex(a.session)
        : a.draw_date < b.draw_date
          ? 1
          : -1,
    );

  const analysis = runAnalysis(strategies, {
    date: new Date(`${args.targetDate}T12:00:00Z`),
    session: args.targetSession,
    history: before,
    // Kept for rule compatibility, but the engine now sees the whole
    // available daily sequence, not just three draws.
    previousThree: sequence.length ? sequence : before.slice(0, 3),
  });

  // Re-score with learning applied.
  const adjusted = analysis.ranked
    .map((r) => {
      let score = 0;
      for (const h of r.hits) score += h.weight * (learning.strategyMultiplier[h.strategyId] ?? 1);
      score += learning.numberAdjust[r.number] ?? 0;
      return { entry: r, score };
    })
    .sort((a, b) => b.score - a.score || b.entry.agreement - a.entry.agreement)
    .filter((r) => r.score > 0);

  const pool = adjusted.map((r) => pick(r.entry, r.score));
  if (pool.length < 3) {
    return {
      target_date: args.targetDate,
      target_session: args.targetSession,
      bankers: pool.slice(0, 1),
      rows: [],
      pool,
      strategy_count: strategies.length,
      history_depth: before.length,
    };
  }

  // Co-occurrence of pairs across the stored history.
  const co = new Map<string, number>();
  for (const d of before) {
    const nums = drawNumbers(d);
    for (let i = 0; i < nums.length; i++)
      for (let j = i + 1; j < nums.length; j++) {
        const a = Math.min(nums[i]!, nums[j]!);
        const b = Math.max(nums[i]!, nums[j]!);
        co.set(`${a}-${b}`, (co.get(`${a}-${b}`) ?? 0) + 1);
      }
  }
  const denom = Math.max(before.length, 1);
  const coRate = (a: number, b: number) =>
    (co.get(`${Math.min(a, b)}-${Math.max(a, b)}`) ?? 0) / denom;

  const bankers = pool.slice(0, Math.min(2, pool.length));
  const bankerIds = new Set(bankers.map((b) => b.n));
  const partners = pool.filter((p) => !bankerIds.has(p.n));

  interface Candidate {
    banker: PickedNumber;
    partner: PickedNumber;
    score: number;
  }
  const candidates: Candidate[] = [];
  for (const b of bankers) {
    for (const p of partners) {
      const shared = p.strategyIds.filter((id) => b.strategyIds.includes(id)).length;
      candidates.push({
        banker: b,
        partner: p,
        score: b.score * 0.35 + p.score + shared * 1.5 + coRate(b.n, p.n) * 8,
      });
    }
  }
  candidates.sort((x, y) => y.score - x.score);

  const usedPartners = new Set<number>();
  const perBanker = new Map<number, number>();
  const cap = Math.ceil(rowCount / bankers.length);
  const rows: PredictionRow[] = [];
  for (const c of candidates) {
    if (rows.length >= rowCount) break;
    if (usedPartners.has(c.partner.n)) continue;
    if ((perBanker.get(c.banker.n) ?? 0) >= cap) continue;
    perBanker.set(c.banker.n, (perBanker.get(c.banker.n) ?? 0) + 1);
    usedPartners.add(c.partner.n);
    rows.push({ banker: c.banker, pair: [c.banker, c.partner], bonus: c.partner });
  }

  // Bonus column: the next strongest candidates that are not already
  // used as a banker or pair partner; fall back to the pool tail.
  const bonusPool = pool.filter((p) => !bankerIds.has(p.n) && !usedPartners.has(p.n));
  rows.forEach((row, i) => {
    const b = bonusPool[i] ?? pool[(i + bankers.length + rows.length) % pool.length];
    if (b) row.bonus = b;
  });

  return {
    target_date: args.targetDate,
    target_session: args.targetSession,
    bankers,
    rows,
    pool: pool.slice(0, 24),
    strategy_count: strategies.length,
    history_depth: before.length,
  };
}

/* ------------------------------------------------------------------ */
/* Grading: prediction -> actual result -> match check                 */
/* ------------------------------------------------------------------ */

export function gradePrediction(prediction: Prediction, draw: Draw): Grading {
  const actual = drawNumbers(draw);
  const hit = (n: number) => actual.includes(n);

  const rows: RowGrade[] = prediction.rows.map((r) => ({
    bankerHit: hit(r.banker.n),
    pairHits: [hit(r.pair[0].n), hit(r.pair[1].n)] as [boolean, boolean],
    pairFullHit: hit(r.pair[0].n) && hit(r.pair[1].n),
    bonusHit: hit(r.bonus.n) || (draw.booster != null && draw.booster === r.bonus.n),
  }));

  const picked = new Map<number, PickedNumber>();
  for (const p of [...prediction.bankers, ...prediction.pool])
    if (!picked.has(p.n)) picked.set(p.n, p);
  for (const r of prediction.rows)
    for (const p of [r.banker, r.pair[0], r.pair[1], r.bonus])
      if (!picked.has(p.n)) picked.set(p.n, p);

  const poolHits: number[] = [];
  const poolMisses: number[] = [];
  const strategies: Grading["strategies"] = {};

  for (const p of picked.values()) {
    const isHit = hit(p.n);
    (isHit ? poolHits : poolMisses).push(p.n);
    p.strategyIds.forEach((id, i) => {
      const name = p.strategies[i] ?? p.strategies[0] ?? id;
      const s = (strategies[id] ??= { name, hits: 0, misses: 0 });
      if (isHit) s.hits += 1;
      else s.misses += 1;
    });
  }

  return {
    actual,
    booster: draw.booster,
    rows,
    poolHits: poolHits.sort((a, b) => a - b),
    poolMisses: poolMisses.sort((a, b) => a - b),
    strategies,
    matched: poolHits.length,
  };
}
