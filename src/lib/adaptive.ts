/**
 * ADAPTIVE SCORING LAYER — additive.
 *
 * The existing formula (src/lib/engine.ts + src/lib/predict.ts) stays the CORE
 * ENGINE and is never replaced here. This layer only *measures* how each
 * strategy has been behaving, strictly out of sample (walk-forward), and turns
 * that into an adaptive strategy score plus a model-confidence read-out:
 *
 *   historical performance → recent performance → date strength →
 *   draw-time strength → prediction lag → confirmation → adaptive score
 */
import { replayFormula, dateFeatures, type Slot } from "./date-intel";
import type { StructuredDraw } from "./structure";
import { SESSION_LABELS, type SessionKey, type Strategy } from "./uk49";

export type Trend = "up" | "flat" | "down";

export interface AdaptiveWindows {
  /** Hit rate over the whole replay. */
  allTime: number;
  /** Hit rate over the last 365 days before the target draw. */
  d365: number;
  d90: number;
  d30: number;
}

export interface StrategyAdaptive {
  strategyId: string;
  strategy: string;
  /** Tests run in the walk-forward replay. */
  tests: number;
  /** Share of replayed draws where the strategy produced at least one hit. */
  historical: number;
  /** Same, over the most recent slots only. */
  recent: number;
  /** Multi-window performance: 40% all-time / 25% 365d / 20% 90d / 15% 30d. */
  windows: AdaptiveWindows;
  /** The weighted 0-1 base performance from the four windows. */
  windowScore: number;
  /** Recent vs historical average matches, 1 = unchanged. */
  dateStrength: number;
  sessionStrength: number;
  /** Share of landed numbers that landed on the very same draw. */
  lagScore: number;
  /** Average number of other strategies that agreed on its numbers. */
  confirmation: number;
  /** 0-100 adaptive strategy score. */
  score: number;
  trend: Trend;
}

export interface AdaptiveNumber {
  n: number;
  score: number;
  strategies: string[];
  agreement: number;
}

export interface StrategyEvaluation {
  strategyId: string;
  strategy: string;
  predicted: number;
  matched: number;
  performance: Trend;
}

export interface AdaptiveReport {
  slots: number;
  strategies: StrategyAdaptive[];
  numbers: AdaptiveNumber[];
  /** 0-100 agreement-based model confidence for the next draw. */
  confidence: number;
  confidenceLabel: "high" | "medium" | "low";
  /** Result evaluation of the last completed draw in the sequence. */
  evaluation: StrategyEvaluation[];
  evaluatedDraw: {
    date: string;
    session: SessionKey;
    sessionLabel: string;
    numbers: number[];
  } | null;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ratio = (a: number, b: number) => (b > 0 ? a / b : a > 0 ? 2 : 1);

interface Acc {
  strategyId: string;
  strategy: string;
  tests: number;
  hits: number;
  matchSum: number;
  produced: number;
  recentTests: number;
  recentHits: number;
  recentMatchSum: number;
  dateTests: number;
  dateMatchSum: number;
  sessionTests: number;
  sessionMatchSum: number;
  sameDraw: number;
  landed: number;
  agreementSum: number;
  agreementCount: number;
  w365Tests: number;
  w365Hits: number;
  w90Tests: number;
  w90Hits: number;
  w30Tests: number;
  w30Hits: number;
}

const DAY = 86_400_000;
const daysBefore = (target: string, date: string) =>
  Math.max(0, (Date.parse(`${target}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / DAY);

function numbersByStrategy(slot: Slot) {
  const map = new Map<string, { name: string; numbers: number[]; agreement: number[] }>();
  for (const r of slot.ranked)
    for (const h of r.hits) {
      const e = map.get(h.strategyId) ?? { name: h.strategy, numbers: [], agreement: [] };
      e.numbers.push(r.number);
      e.agreement.push(Math.max(0, r.agreement - 1));
      map.set(h.strategyId, e);
    }
  return map;
}

/**
 * Walk-forward measurement. `target` describes the draw we are about to
 * predict so date/session strength is measured under the same conditions.
 */
export function adaptiveLayer(
  strategies: Strategy[],
  sequence: StructuredDraw[],
  target: { date: string; session: SessionKey },
  slotCount = 80,
): AdaptiveReport {
  const slots = replayFormula(strategies, sequence, undefined, slotCount);
  const recentFrom = Math.max(0, slots.length - 12);
  const targetWeekday = dateFeatures(target.date).weekday;

  const acc = new Map<string, Acc>();
  const ensure = (id: string, name: string): Acc => {
    let a = acc.get(id);
    if (!a) {
      a = {
        strategyId: id,
        strategy: name,
        tests: 0,
        hits: 0,
        matchSum: 0,
        produced: 0,
        recentTests: 0,
        recentHits: 0,
        recentMatchSum: 0,
        dateTests: 0,
        dateMatchSum: 0,
        sessionTests: 0,
        sessionMatchSum: 0,
        sameDraw: 0,
        landed: 0,
        agreementSum: 0,
        agreementCount: 0,
        w365Tests: 0,
        w365Hits: 0,
        w90Tests: 0,
        w90Hits: 0,
        w30Tests: 0,
        w30Hits: 0,
      };

      acc.set(id, a);
    }
    return a;
  };

  slots.forEach((slot, si) => {
    const actual = new Set(slot.draw.numbers);
    const weekday = dateFeatures(slot.draw.date).weekday;
    for (const [id, e] of numbersByStrategy(slot)) {
      const a = ensure(id, e.name);
      const matched = e.numbers.filter((n) => actual.has(n)).length;
      a.tests += 1;
      a.produced += e.numbers.length;
      a.matchSum += matched;
      if (matched) a.hits += 1;
      const age = daysBefore(target.date, slot.draw.date);
      if (age <= 365) {
        a.w365Tests += 1;
        if (matched) a.w365Hits += 1;
      }
      if (age <= 90) {
        a.w90Tests += 1;
        if (matched) a.w90Hits += 1;
      }
      if (age <= 30) {
        a.w30Tests += 1;
        if (matched) a.w30Hits += 1;
      }

      if (si >= recentFrom) {
        a.recentTests += 1;
        a.recentMatchSum += matched;
        if (matched) a.recentHits += 1;
      }
      if (weekday === targetWeekday) {
        a.dateTests += 1;
        a.dateMatchSum += matched;
      }
      if (slot.draw.session === target.session) {
        a.sessionTests += 1;
        a.sessionMatchSum += matched;
      }
      for (const ag of e.agreement) {
        a.agreementSum += ag;
        a.agreementCount += 1;
      }
      /* Lag: did the produced number land on this draw, or later? */
      for (const n of e.numbers) {
        for (let lag = 0; lag <= 4; lag++) {
          const future = sequence[slot.index + lag];
          if (!future) break;
          if (future.numbers.includes(n)) {
            a.landed += 1;
            if (lag === 0) a.sameDraw += 1;
            break;
          }
        }
      }
    }
  });

  const adaptive: StrategyAdaptive[] = Array.from(acc.values()).map((a) => {
    const avg = a.tests ? a.matchSum / a.tests : 0;
    const historical = a.tests ? a.hits / a.tests : 0;
    const recent = a.recentTests ? a.recentHits / a.recentTests : historical;
    const recentAvg = a.recentTests ? a.recentMatchSum / a.recentTests : avg;
    const dateStrength = ratio(a.dateTests ? a.dateMatchSum / a.dateTests : avg, avg);
    const sessionStrength = ratio(a.sessionTests ? a.sessionMatchSum / a.sessionTests : avg, avg);
    const lagScore = a.landed ? a.sameDraw / a.landed : 0;
    const confirmation = a.agreementCount ? a.agreementSum / a.agreementCount : 0;

    /* Multi-window performance, per spec: 40% long term, 25% 365d,
       20% 90d, 15% 30d. Empty windows fall back to the long-term rate so a
       short dataset never zeroes a strategy out. */
    const windows: AdaptiveWindows = {
      allTime: historical,
      d365: a.w365Tests ? a.w365Hits / a.w365Tests : historical,
      d90: a.w90Tests ? a.w90Hits / a.w90Tests : historical,
      d30: a.w30Tests ? a.w30Hits / a.w30Tests : historical,
    };
    const windowScore =
      0.4 * windows.allTime + 0.25 * windows.d365 + 0.2 * windows.d90 + 0.15 * windows.d30;

    const score =
      100 *
      clamp01(
        0.62 * windowScore +
          0.1 * clamp01((dateStrength - 0.5) / 1.5) +
          0.1 * clamp01((sessionStrength - 0.5) / 1.5) +
          0.1 * lagScore +
          0.08 * clamp01(confirmation / 4),
      );

    const delta = recentAvg - avg;
    const trend: Trend = delta > 0.15 ? "up" : delta < -0.15 ? "down" : "flat";

    return {
      strategyId: a.strategyId,
      strategy: a.strategy,
      tests: a.tests,
      historical,
      recent,
      windows,
      windowScore: Number(windowScore.toFixed(4)),
      dateStrength,
      sessionStrength,
      lagScore,
      confirmation,
      score: Number(score.toFixed(1)),
      trend,
    };
  });
  adaptive.sort((x, y) => y.score - x.score);

  /* Adaptive number scores: the CURRENT formula run, re-weighted by how each
     strategy has actually been performing. Nothing is removed from the pool. */
  const last = slots[slots.length - 1];
  const byId = new Map(adaptive.map((s) => [s.strategyId, s]));
  const numbers: AdaptiveNumber[] = [];
  if (last) {
    for (const r of last.ranked) {
      let score = 0;
      const names: string[] = [];
      for (const h of r.hits) {
        const m = byId.get(h.strategyId);
        score += h.weight * (m ? 0.5 + m.score / 100 : 1);
        if (!names.includes(h.strategy)) names.push(h.strategy);
      }
      numbers.push({
        n: r.number,
        score: Number(score.toFixed(2)),
        strategies: names,
        agreement: r.agreement,
      });
    }
    numbers.sort((a, b) => b.score - a.score || b.agreement - a.agreement);
  }

  const top = numbers.slice(0, 5);
  const avgAgreement = top.length ? top.reduce((s, t) => s + t.agreement, 0) / top.length : 0;
  const avgStrategyScore = adaptive.length
    ? adaptive.slice(0, 6).reduce((s, a) => s + a.score, 0) / Math.min(6, adaptive.length)
    : 0;
  const confidence = Math.round(
    clamp01(0.55 * clamp01(avgAgreement / 5) + 0.45 * clamp01(avgStrategyScore / 60)) * 100,
  );

  /* Result evaluation of the last completed draw. */
  const evalSlot = slots[slots.length - 1];
  let evaluation: StrategyEvaluation[] = [];
  let evaluatedDraw: AdaptiveReport["evaluatedDraw"] = null;
  if (evalSlot) {
    const actual = new Set(evalSlot.draw.numbers);
    evaluation = Array.from(numbersByStrategy(evalSlot).entries())
      .map(([id, e]) => {
        const matched = e.numbers.filter((n) => actual.has(n)).length;
        const rate = e.numbers.length ? matched / e.numbers.length : 0;
        const base = byId.get(id)?.historical ?? 0;
        return {
          strategyId: id,
          strategy: e.name,
          predicted: e.numbers.length,
          matched,
          performance: (rate > base + 0.05 ? "up" : rate < base - 0.05 ? "down" : "flat") as Trend,
        };
      })
      .sort((a, b) => b.matched - a.matched || a.strategy.localeCompare(b.strategy));
    evaluatedDraw = {
      date: evalSlot.draw.date,
      session: evalSlot.draw.session,
      sessionLabel: SESSION_LABELS[evalSlot.draw.session] ?? evalSlot.draw.session,
      numbers: evalSlot.draw.numbers,
    };
  }

  return {
    slots: slots.length,
    strategies: adaptive,
    numbers: numbers.slice(0, 20),
    confidence,
    confidenceLabel: confidence >= 70 ? "high" : confidence >= 45 ? "medium" : "low",
    evaluation,
    evaluatedDraw,
  };
}
