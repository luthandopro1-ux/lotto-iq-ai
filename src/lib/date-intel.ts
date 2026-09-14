/**
 * DATE INTELLIGENCE + FORMULA LAG.
 *
 * Measures, out of sample, which strategies of the existing formula perform
 * best under specific calendar conditions and how long their numbers take to
 * land (same draw, next draw, within the day). Purely observational — it
 * never rewrites a strategy.
 */
import { runAnalysis, type ScoredNumber } from "./engine";
import type { StructuredDraw } from "./structure";
import { SESSION_LABELS, type Draw, type SessionKey, type Strategy } from "./uk49";

export interface DateFeatures {
  weekday: number;
  weekdayLabel: string;
  dayOfMonth: number;
  month: number;
  /** Digit sum of the date, folded to 1-9. */
  dateRoot: number;
  /** True when day of month is even. */
  evenDay: boolean;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dateFeatures(date: string): DateFeatures {
  const d = new Date(`${date}T12:00:00Z`);
  const digits = date
    .replace(/\D/g, "")
    .split("")
    .reduce((a, c) => a + Number(c), 0);
  return {
    weekday: d.getUTCDay(),
    weekdayLabel: WEEKDAYS[d.getUTCDay()] ?? "",
    dayOfMonth: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    dateRoot: digits <= 0 ? 0 : 1 + ((digits - 1) % 9),
    evenDay: d.getUTCDate() % 2 === 0,
  };
}

export interface StrategyDatePerf {
  strategyId: string;
  strategy: string;
  tests: number;
  hits: number;
  hitRate: number;
  /** Average matched numbers per run. */
  avgMatches: number;
  /** Average draws between the strategy producing a number and that number landing. */
  avgLag: number;
  lagBuckets: { same: number; next: number; withinDay: number; later: number };
}

export interface DateIntelBucket {
  label: string;
  tests: number;
  avgMatches: number;
  best: StrategyDatePerf[];
}

export interface DateIntelReport {
  perStrategy: StrategyDatePerf[];
  byWeekday: DateIntelBucket[];
  bySession: DateIntelBucket[];
  byDateRoot: DateIntelBucket[];
  slots: number;
}

export interface Slot {
  index: number;
  draw: StructuredDraw;
  ranked: ScoredNumber[];
}

/** Rebuilds a Draw-shaped record so the engine receives the exact same
 *  context type it gets in live prediction. */
export function toDraw(d: StructuredDraw): Draw {
  const [n1 = 0, n2 = 0, n3 = 0, n4 = 0, n5 = 0, n6 = 0] = d.numbers;
  return {
    id: d.id,
    draw_date: d.date,
    session: d.session,
    n1,
    n2,
    n3,
    n4,
    n5,
    n6,
    booster: d.bonus,
    source: null,
    created_at: d.date,
  };
}

/**
 * Replays the existing strategy engine over history — for every slot the
 * engine only sees the draws before it, so nothing is fitted on the future.
 */
export function replayFormula(
  strategies: Strategy[],
  sequence: StructuredDraw[],
  rawHistory: { id: string }[] | undefined,
  slots = 60,
): Slot[] {
  void rawHistory;
  const start = Math.max(3, sequence.length - slots);
  const out: Slot[] = [];
  const draws = sequence.map(toDraw);
  for (let i = start; i < sequence.length; i++) {
    const target = sequence[i]!;
    // Newest first, exactly like the live prediction path.
    const past = draws.slice(0, i).reverse();
    let ranked: ScoredNumber[] = [];
    try {
      ranked = runAnalysis(strategies, {
        date: new Date(`${target.date}T12:00:00Z`),
        session: target.session,
        history: past,
        previousThree: past.slice(0, 3),
      }).ranked;
    } catch {
      ranked = [];
    }
    out.push({ index: i, draw: target, ranked });
  }
  return out;
}

export function dateIntelligence(
  strategies: Strategy[],
  sequence: StructuredDraw[],
  slotCount = 60,
): DateIntelReport {
  const slots = replayFormula(strategies, sequence, undefined, slotCount);

  const acc = new Map<
    string,
    StrategyDatePerf & { lagSum: number; lagCount: number; matchSum: number }
  >();
  const bucket = new Map<
    string,
    { tests: number; matchSum: number; perStrategy: Map<string, number> }
  >();

  const touch = (key: string) =>
    bucket.get(key) ?? bucket.set(key, { tests: 0, matchSum: 0, perStrategy: new Map() }).get(key)!;

  for (const slot of slots) {
    const actual = new Set(slot.draw.numbers);
    const f = dateFeatures(slot.draw.date);
    const keys = [`wd:${f.weekdayLabel}`, `se:${slot.draw.session}`, `dr:${f.dateRoot}`];
    for (const k of keys) touch(k).tests += 1;

    const byStrategy = new Map<string, number[]>();
    for (const r of slot.ranked)
      for (const h of r.hits) {
        const list = byStrategy.get(h.strategyId) ?? [];
        list.push(r.number);
        byStrategy.set(h.strategyId, list);
        if (!acc.has(h.strategyId))
          acc.set(h.strategyId, {
            strategyId: h.strategyId,
            strategy: h.strategy,
            tests: 0,
            hits: 0,
            hitRate: 0,
            avgMatches: 0,
            avgLag: 0,
            lagBuckets: { same: 0, next: 0, withinDay: 0, later: 0 },
            lagSum: 0,
            lagCount: 0,
            matchSum: 0,
          });
      }

    for (const [id, numbers] of byStrategy) {
      const rec = acc.get(id)!;
      rec.tests += 1;
      const matched = numbers.filter((n) => actual.has(n));
      rec.matchSum += matched.length;
      if (matched.length) rec.hits += 1;

      for (const k of keys) {
        const b = touch(k);
        b.perStrategy.set(id, (b.perStrategy.get(id) ?? 0) + matched.length);
        b.matchSum += matched.length;
      }

      /* Lag: how many draws later the produced numbers actually landed. */
      for (const n of numbers) {
        for (let lag = 0; lag <= 4; lag++) {
          const future = sequence[slot.index + lag];
          if (!future) break;
          if (future.numbers.includes(n)) {
            rec.lagSum += lag;
            rec.lagCount += 1;
            if (lag === 0) rec.lagBuckets.same += 1;
            else if (lag === 1) rec.lagBuckets.next += 1;
            else if (lag <= 3) rec.lagBuckets.withinDay += 1;
            else rec.lagBuckets.later += 1;
            break;
          }
        }
      }
    }
  }

  const perStrategy: StrategyDatePerf[] = Array.from(acc.values())
    .map((r) => ({
      strategyId: r.strategyId,
      strategy: r.strategy,
      tests: r.tests,
      hits: r.hits,
      hitRate: r.tests ? r.hits / r.tests : 0,
      avgMatches: r.tests ? r.matchSum / r.tests : 0,
      avgLag: r.lagCount ? r.lagSum / r.lagCount : 0,
      lagBuckets: r.lagBuckets,
    }))
    .sort((a, b) => b.avgMatches - a.avgMatches);

  const byId = new Map(perStrategy.map((p) => [p.strategyId, p]));
  const buildBuckets = (prefix: string, label: (k: string) => string): DateIntelBucket[] =>
    Array.from(bucket.entries())
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => ({
        label: label(k.slice(prefix.length)),
        tests: v.tests,
        avgMatches: v.tests ? v.matchSum / v.tests : 0,
        best: Array.from(v.perStrategy.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id]) => byId.get(id))
          .filter(Boolean) as StrategyDatePerf[],
      }))
      .sort((a, b) => b.avgMatches - a.avgMatches);

  return {
    perStrategy,
    byWeekday: buildBuckets("wd:", (k) => k),
    bySession: buildBuckets("se:", (k) => SESSION_LABELS[k as SessionKey] ?? k),
    byDateRoot: buildBuckets("dr:", (k) => `Date root ${k}`),
    slots: slots.length,
  };
}
