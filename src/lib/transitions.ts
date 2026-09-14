/**
 * TRANSITION + LAG ENGINE.
 *
 * Learns, from the real chronological UK49s sequence, what tends to follow
 * an active structure: wheel → wheel/family/section, family → …, section → …
 * and which individual numbers follow. Every relationship carries its own
 * sample size and an evidence tier, so a single occurrence is never treated
 * as a strong signal.
 */
import {
  keysOf,
  groupOfNumber,
  structureKeys,
  type StructureKind,
  type StructuredDraw,
} from "./structure";
import type { SessionKey } from "./uk49";

export type Evidence = "strong" | "moderate" | "weak" | "insufficient";

export const MIN_SAMPLE = { strong: 30, moderate: 12, weak: 5 };

export function evidenceFor(sample: number): Evidence {
  if (sample >= MIN_SAMPLE.strong) return "strong";
  if (sample >= MIN_SAMPLE.moderate) return "moderate";
  if (sample >= MIN_SAMPLE.weak) return "weak";
  return "insufficient";
}

/** Confidence shrinkage — small samples are pulled back toward the baseline. */
export const shrink = (rate: number, sample: number, base: number, k = 20) =>
  (rate * sample + base * k) / (sample + k);

export const EVIDENCE_STYLE: Record<Evidence, string> = {
  strong: "bg-emerald-500/15 text-emerald-400",
  moderate: "bg-primary/15 text-primary",
  weak: "bg-amber-500/15 text-amber-400",
  insufficient: "bg-muted text-muted-foreground",
};

/** Lag horizons measured for every relationship. */
export const HORIZONS = [1, 2, 3, 4] as const;
export type Horizon = (typeof HORIZONS)[number];
export const HORIZON_LABEL: Record<Horizon, string> = {
  1: "next draw",
  2: "within 2",
  3: "within 3",
  4: "within 4 (next day)",
};

export interface TransitionCell {
  from: string;
  to: string;
  /** Times `from` was active. */
  sample: number;
  /** Times `to` followed, per horizon. */
  hits: Record<Horizon, number>;
  /** Observed rate at horizon 1. */
  rate: number;
  /** Shrunk rate at horizon 1, compared against the base rate of `to`. */
  adjusted: number;
  /** adjusted / baseline — >1 means the transition is above chance. */
  lift: number;
  /** Recency-weighted rate at horizon 1. */
  recentRate: number;
  evidence: Evidence;
}

export interface TransitionMatrix {
  fromKind: StructureKind;
  toKind: StructureKind;
  cells: TransitionCell[];
  byFrom: Record<string, TransitionCell[]>;
  baseline: Record<string, number>;
  sample: number;
  session: SessionKey | "all";
}

interface BuildOptions {
  /** Restrict the FOLLOWING draw to one session. */
  session?: SessionKey | "all";
  /** Half-life in draws for the recency weighting. */
  halfLife?: number;
}

/**
 * Build a from-structure → to-structure transition matrix.
 * `sequence` must be chronological, oldest first.
 */
export function buildTransitions(
  sequence: StructuredDraw[],
  fromKind: StructureKind,
  toKind: StructureKind,
  options: BuildOptions = {},
): TransitionMatrix {
  const session = options.session ?? "all";
  const halfLife = options.halfLife ?? 80;
  const decay = Math.pow(0.5, 1 / halfLife);

  const fromKeys = keysOf(fromKind);
  const toKeys = keysOf(toKind);

  const baseCount: Record<string, number> = Object.fromEntries(toKeys.map((k) => [k, 0]));
  let baseTotal = 0;
  for (const d of sequence) {
    if (session !== "all" && d.session !== session) continue;
    baseTotal += 1;
    for (const k of structureKeys(toKind, d)) baseCount[k] = (baseCount[k] ?? 0) + 1;
  }
  const baseline: Record<string, number> = Object.fromEntries(
    toKeys.map((k) => [k, (baseCount[k] ?? 0) / Math.max(baseTotal, 1)]),
  );

  const sampleOf: Record<string, number> = Object.fromEntries(fromKeys.map((k) => [k, 0]));
  const wSample: Record<string, number> = Object.fromEntries(fromKeys.map((k) => [k, 0]));
  const hits: Record<string, Record<string, Record<Horizon, number>>> = {};
  const wHits: Record<string, Record<string, number>> = {};

  const last = sequence.length - 1;
  for (let i = 0; i < sequence.length - 1; i++) {
    const from = sequence[i]!;
    const age = last - i;
    const w = Math.pow(decay, age);
    const followers = sequence.slice(i + 1, i + 1 + 4);
    const scoped = followers.filter((f) => session === "all" || f.session === session);
    if (!scoped.length) continue;

    for (const fk of structureKeys(fromKind, from)) {
      sampleOf[fk] = (sampleOf[fk] ?? 0) + 1;
      wSample[fk] = (wSample[fk] ?? 0) + w;
      const row = (hits[fk] ??= {});
      const wRow = (wHits[fk] ??= {});
      const seen = new Set<string>();
      scoped.forEach((f, idx) => {
        const horizon = Math.min(4, idx + 1) as Horizon;
        for (const tk of structureKeys(toKind, f)) {
          const cell = (row[tk] ??= { 1: 0, 2: 0, 3: 0, 4: 0 });
          if (!seen.has(`${tk}`)) {
            // first time this target appears within the window
            for (const h of HORIZONS) if (h >= horizon) cell[h] += 1;
            seen.add(`${tk}`);
            if (horizon === 1) wRow[tk] = (wRow[tk] ?? 0) + w;
          }
        }
      });
    }
  }

  const cells: TransitionCell[] = [];
  for (const fk of fromKeys) {
    const sample = sampleOf[fk] ?? 0;
    for (const tk of toKeys) {
      const cell = hits[fk]?.[tk] ?? { 1: 0, 2: 0, 3: 0, 4: 0 };
      const rate = sample ? cell[1] / sample : 0;
      const base = baseline[tk] ?? 0;
      const adjusted = shrink(rate, sample, base);
      cells.push({
        from: fk,
        to: tk,
        sample,
        hits: cell,
        rate,
        adjusted,
        lift: base > 0 ? adjusted / base : 0,
        recentRate: (wSample[fk] ?? 0) > 0 ? (wHits[fk]?.[tk] ?? 0) / wSample[fk]! : 0,
        evidence: evidenceFor(sample),
      });
    }
  }

  const byFrom: Record<string, TransitionCell[]> = {};
  for (const c of cells) (byFrom[c.from] ??= []).push(c);
  for (const k of Object.keys(byFrom)) byFrom[k]!.sort((a, b) => b.lift - a.lift);

  return { fromKind, toKind, cells, byFrom, baseline, sample: sequence.length, session };
}

/* ------------------------------------------------------------------ */
/* Number-level follow-through                                         */
/* ------------------------------------------------------------------ */

export interface NumberTransition {
  number: number;
  sample: number;
  rate: number;
  adjusted: number;
  lift: number;
  evidence: Evidence;
}

/** Which individual numbers historically follow an active group. */
export function numbersAfterGroup(
  sequence: StructuredDraw[],
  kind: StructureKind,
  key: string,
  options: BuildOptions = {},
): NumberTransition[] {
  const session = options.session ?? "all";
  const counts = new Map<number, number>();
  const baseCounts = new Map<number, number>();
  let sample = 0;
  let baseTotal = 0;

  for (let i = 0; i < sequence.length - 1; i++) {
    const next = sequence[i + 1]!;
    if (session !== "all" && next.session !== session) continue;
    baseTotal += 1;
    for (const n of next.numbers) baseCounts.set(n, (baseCounts.get(n) ?? 0) + 1);
    if (!structureKeys(kind, sequence[i]!).includes(key)) continue;
    sample += 1;
    for (const n of next.numbers) counts.set(n, (counts.get(n) ?? 0) + 1);
  }

  return Array.from({ length: 49 }, (_, i) => i + 1)
    .map((n) => {
      const rate = sample ? (counts.get(n) ?? 0) / sample : 0;
      const base = baseTotal ? (baseCounts.get(n) ?? 0) / baseTotal : 6 / 49;
      const adjusted = shrink(rate, sample, base, 25);
      return {
        number: n,
        sample,
        rate,
        adjusted,
        lift: base > 0 ? adjusted / base : 0,
        evidence: evidenceFor(sample),
      };
    })
    .sort((a, b) => b.lift - a.lift);
}

/* ------------------------------------------------------------------ */
/* "What played first?" — which structure leads                        */
/* ------------------------------------------------------------------ */

export interface LeadResult {
  from: StructureKind;
  to: StructureKind;
  /** Mean lift of the strongest follower per active group, above 1 = predictive. */
  predictiveLift: number;
  /** Share of draws where the top-lift follower actually landed next. */
  accuracy: number;
  sample: number;
  evidence: Evidence;
}

const KINDS: StructureKind[] = ["wheel", "family", "section"];

/**
 * Tests every structure-to-structure ordering out of sample: the matrix is
 * built on the first 70 % of history and scored on the remaining 30 %.
 */
export function whatPlayedFirst(
  sequence: StructuredDraw[],
  options: BuildOptions = {},
): LeadResult[] {
  const split = Math.floor(sequence.length * 0.7);
  const train = sequence.slice(0, split);
  const test = sequence.slice(split);
  const out: LeadResult[] = [];

  for (const from of KINDS) {
    for (const to of KINDS) {
      const m = buildTransitions(train, from, to, options);
      let hits = 0;
      let tries = 0;
      let liftSum = 0;
      for (let i = 0; i < test.length - 1; i++) {
        const active = structureKeys(from, test[i]!);
        const next = new Set(structureKeys(to, test[i + 1]!));
        for (const key of active) {
          const best = m.byFrom[key]?.[0];
          if (!best || best.evidence === "insufficient") continue;
          tries += 1;
          liftSum += best.lift;
          if (next.has(best.to)) hits += 1;
        }
      }
      out.push({
        from,
        to,
        predictiveLift: tries ? liftSum / tries : 0,
        accuracy: tries ? hits / tries : 0,
        sample: tries,
        evidence: evidenceFor(tries),
      });
    }
  }

  return out.sort((a, b) => b.accuracy * b.predictiveLift - a.accuracy * a.predictiveLift);
}

/* ------------------------------------------------------------------ */
/* Structural support score per number                                 */
/* ------------------------------------------------------------------ */

export interface StructuralSupport {
  /** 0..1 support from each structure layer for every number. */
  wheel: Record<number, number>;
  family: Record<number, number>;
  section: Record<number, number>;
  evidence: Record<StructureKind, Evidence>;
  detail: Record<number, Record<StructureKind, { group: string; lift: number; sample: number }>>;
}

const normaliseMap = (raw: Record<number, number>): Record<number, number> => {
  const vals = Object.values(raw);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min;
  const out: Record<number, number> = {};
  for (const k of Object.keys(raw)) {
    const n = Number(k);
    out[n] = span === 0 ? 0.5 : ((raw[n] ?? 0) - min) / span;
  }
  return out;
};

/**
 * Turns the transition matrices into a per-number support score for the next
 * draw, given which structures are currently active.
 */
export function structuralSupport(
  sequence: StructuredDraw[],
  options: BuildOptions = {},
): StructuralSupport {
  const last = sequence[sequence.length - 1];
  const numbers = Array.from({ length: 49 }, (_, i) => i + 1);
  const empty = Object.fromEntries(numbers.map((n) => [n, 0])) as Record<number, number>;
  const detail: StructuralSupport["detail"] = Object.fromEntries(
    numbers.map((n) => [
      n,
      {} as Record<StructureKind, { group: string; lift: number; sample: number }>,
    ]),
  );
  if (!last) {
    return {
      wheel: empty,
      family: { ...empty },
      section: { ...empty },
      evidence: { wheel: "insufficient", family: "insufficient", section: "insufficient" },
      detail,
    };
  }

  const result = {} as Record<StructureKind, Record<number, number>>;
  const evidence = {} as Record<StructureKind, Evidence>;

  for (const kind of KINDS) {
    const m = buildTransitions(sequence, kind, kind, options);
    const active = structureKeys(kind, last);
    const raw: Record<number, number> = Object.fromEntries(numbers.map((n) => [n, 0]));
    let bestSample = 0;
    for (const n of numbers) {
      const group = groupOfNumber(kind, n);
      let acc = 0;
      let sample = 0;
      for (const from of active) {
        const cell = m.byFrom[from]?.find((c) => c.to === group);
        if (!cell) continue;
        acc += cell.lift;
        sample = Math.max(sample, cell.sample);
      }
      const lift = active.length ? acc / active.length : 0;
      raw[n] = lift;
      bestSample = Math.max(bestSample, sample);
      detail[n]![kind] = { group, lift, sample };
    }
    result[kind] = normaliseMap(raw);
    evidence[kind] = evidenceFor(bestSample);
  }

  return {
    wheel: result.wheel!,
    family: result.family!,
    section: result.section!,
    evidence,
    detail,
  };
}
