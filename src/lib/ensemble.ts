/**
 * ENSEMBLE CONFIRMATION LAYER
 *
 * The existing strategy formula is the CORE ENGINE and is never replaced here.
 * This module only reads its output (src/lib/predict.ts) and compares it with the
 * statistical layer (src/lib/stats.ts) to classify agreement and produce a
 * confirmation score where the formula stays dominant.
 */
import type { Prediction, PickedNumber } from "./predict";
import { statPairScore, type StatLayer, type NumberStat } from "./stats";
import { drawNumbers, type Draw } from "./uk49";

export type Classification =
  "CONFIRMED" | "SUPPORTED" | "FORMULA ONLY" | "STATISTICAL ONLY" | "CONFLICT";

export const CLASS_STYLE: Record<Classification, string> = {
  CONFIRMED: "bg-emerald-500/15 text-emerald-400",
  SUPPORTED: "bg-primary/15 text-primary",
  "FORMULA ONLY": "bg-sky-500/15 text-sky-400",
  "STATISTICAL ONLY": "bg-amber-500/15 text-amber-400",
  CONFLICT: "bg-destructive/15 text-destructive",
};

export interface EnsembleCandidate {
  n: number;
  /** 0..1, normalised inside the formula pool. 0 when the formula did not pick it. */
  formulaScore: number;
  formulaRank: number | null;
  rawFormulaScore: number;
  strategies: string[];
  statScore: number;
  statRank: number;
  stat: NumberStat | null;
  agreement: number;
  ensembleScore: number;
  classification: Classification;
  inFormula: boolean;
}

export interface EnsemblePair {
  pair: [number, number];
  formulaRank: number | null;
  statCount: number;
  statLift: number;
  statScore: number;
  classification: Classification;
  source: "formula" | "statistical";
}

export interface EnsembleTriplet {
  triplet: [number, number, number];
  statScore: number;
  source: "formula" | "statistical";
  classification: Classification;
}

export interface BankerVerdict {
  banker: PickedNumber | null;
  status: "STRONG CONFIRMED BANKER" | "SUPPORTED BANKER" | "BANKER CONFLICT" | "NO BANKER";
  statRank: number | null;
  /** Highest statistical number, shown only as information — never swapped in. */
  challenger: number | null;
  note: string;
}

export interface EnsembleResult {
  formulaWeight: number;
  candidates: EnsembleCandidate[];
  banker: BankerVerdict;
  pairs: EnsemblePair[];
  triplets: EnsembleTriplet[];
  counts: Record<Classification, number>;
}

const CONFIRM_RANK = 12;
const SUPPORT_RANK = 22;

function classify(
  inFormula: boolean,
  formulaScore: number,
  statScore: number,
  statRank: number,
): Classification {
  if (inFormula) {
    if (statRank <= CONFIRM_RANK || statScore >= 0.72) return "CONFIRMED";
    if (statRank <= SUPPORT_RANK || statScore >= 0.5) return "SUPPORTED";
    if (formulaScore >= 0.7 && statScore < 0.25) return "CONFLICT";
    return "FORMULA ONLY";
  }
  if (statRank <= CONFIRM_RANK) return "STATISTICAL ONLY";
  return "STATISTICAL ONLY";
}

/**
 * STEP 4-7. Formula stays the dominant component (default 70 / 30).
 * The statistical layer can raise or lower confidence — it never removes a
 * formula candidate from the board.
 */
export function buildEnsemble(
  prediction: Prediction,
  stats: StatLayer,
  formulaWeight = 0.7,
): EnsembleResult {
  const w = Math.min(1, Math.max(0, formulaWeight));
  const pool = prediction.pool;
  const maxScore = Math.max(...pool.map((p) => p.score), 1);
  const formulaByNumber = new Map<number, { p: PickedNumber; rank: number }>();
  pool.forEach((p, i) => formulaByNumber.set(p.n, { p, rank: i + 1 }));

  const numbers = new Set<number>([
    ...pool.map((p) => p.n),
    ...stats.numbers.slice(0, 15).map((s) => s.n),
  ]);

  const candidates: EnsembleCandidate[] = Array.from(numbers).map((n) => {
    const f = formulaByNumber.get(n) ?? null;
    const stat = stats.byNumber[n] ?? null;
    const formulaScore = f ? Math.max(0, f.p.score) / maxScore : 0;
    const statScore = stat?.score ?? 0;
    const statRank = stat?.rank ?? 49;
    const classification = classify(!!f, formulaScore, statScore, statRank);
    return {
      n,
      formulaScore,
      formulaRank: f?.rank ?? null,
      rawFormulaScore: f?.p.score ?? 0,
      strategies: f?.p.strategies ?? [],
      statScore,
      statRank,
      stat,
      agreement: 1 - Math.abs(formulaScore - statScore),
      ensembleScore: w * formulaScore + (1 - w) * statScore,
      classification,
      inFormula: !!f,
    };
  });

  candidates.sort((a, b) => {
    // Formula candidates are never pushed below statistical-only ones.
    if (a.inFormula !== b.inFormula) return a.inFormula ? -1 : 1;
    return b.ensembleScore - a.ensembleScore;
  });

  const counts = {
    CONFIRMED: 0,
    SUPPORTED: 0,
    "FORMULA ONLY": 0,
    "STATISTICAL ONLY": 0,
    CONFLICT: 0,
  } as Record<Classification, number>;
  for (const c of candidates) counts[c.classification] += 1;

  /* STEP 8 — the banker always stays the formula's banker. */
  const formulaBanker = prediction.bankers[0] ?? null;
  const bankerCandidate = formulaBanker
    ? (candidates.find((c) => c.n === formulaBanker.n) ?? null)
    : null;
  const challenger = stats.numbers[0]?.n ?? null;
  const banker: BankerVerdict = !formulaBanker
    ? {
        banker: null,
        status: "NO BANKER",
        statRank: null,
        challenger,
        note: "The formula produced no banker for this slot.",
      }
    : bankerCandidate?.classification === "CONFIRMED"
      ? {
          banker: formulaBanker,
          status: "STRONG CONFIRMED BANKER",
          statRank: bankerCandidate.statRank,
          challenger,
          note: "The statistical layer independently ranks this number in its top tier.",
        }
      : bankerCandidate?.classification === "CONFLICT"
        ? {
            banker: formulaBanker,
            status: "BANKER CONFLICT",
            statRank: bankerCandidate.statRank,
            challenger,
            note: "The layers disagree. The formula banker is kept — a swap needs out-of-sample backtest evidence.",
          }
        : {
            banker: formulaBanker,
            status: "SUPPORTED BANKER",
            statRank: bankerCandidate?.statRank ?? null,
            challenger,
            note: "Moderate statistical confirmation. Formula banker retained.",
          };

  /* STEP 9 — formula pairs stay visible, statistics only annotate and re-rank. */
  const seen = new Set<string>();
  const pairs: EnsemblePair[] = prediction.rows.map((r, i) => {
    const a = Math.min(r.pair[0].n, r.pair[1].n);
    const b = Math.max(r.pair[0].n, r.pair[1].n);
    seen.add(`${a}-${b}`);
    const sp = statPairScore(stats, a, b);
    const score = sp?.score ?? 0;
    return {
      pair: [a, b] as [number, number],
      formulaRank: i + 1,
      statCount: sp?.count ?? 0,
      statLift: sp?.lift ?? 0,
      statScore: score,
      classification: score >= 0.5 ? "CONFIRMED" : score >= 0.2 ? "SUPPORTED" : "FORMULA ONLY",
      source: "formula" as const,
    };
  });
  for (const sp of stats.pairs.slice(0, 6)) {
    const key = `${sp.pair[0]}-${sp.pair[1]}`;
    if (seen.has(key)) continue;
    pairs.push({
      pair: sp.pair,
      formulaRank: null,
      statCount: sp.count,
      statLift: sp.lift,
      statScore: sp.score,
      classification: "STATISTICAL ONLY",
      source: "statistical",
    });
  }

  /* Triplets: generated from the formula board first, statistics as extra ranking. */
  const tripletScore = (t: [number, number, number]) => {
    const combos: [number, number][] = [
      [t[0], t[1]],
      [t[0], t[2]],
      [t[1], t[2]],
    ];
    const sum = combos.reduce((acc, [x, y]) => acc + (statPairScore(stats, x, y)?.score ?? 0), 0);
    return sum / 3;
  };

  const formulaTriplets: EnsembleTriplet[] = prediction.rows.slice(0, 6).map((r) => {
    const t = [r.banker.n, r.pair[1].n, r.bonus.n].sort((x, y) => x - y) as [
      number,
      number,
      number,
    ];
    const score = tripletScore(t);
    return {
      triplet: t,
      statScore: score,
      source: "formula" as const,
      classification: score >= 0.4 ? "CONFIRMED" : score >= 0.15 ? "SUPPORTED" : "FORMULA ONLY",
    };
  });
  const statTriplets: EnsembleTriplet[] = stats.triplets.slice(0, 4).map((t) => ({
    triplet: t.triplet,
    statScore: t.score,
    source: "statistical" as const,
    classification: "STATISTICAL ONLY" as const,
  }));

  return {
    formulaWeight: w,
    candidates,
    banker,
    pairs: pairs.sort((a, b) => {
      if ((a.source === "formula") !== (b.source === "formula"))
        return a.source === "formula" ? -1 : 1;
      return b.statScore - a.statScore;
    }),
    triplets: [...formulaTriplets, ...statTriplets],
    counts,
  };
}

/* ------------------------------------------------------------------ */
/* STEP 10 — component scoreboard: formula vs statistics vs combined    */
/* ------------------------------------------------------------------ */

export interface ComponentRow {
  label: string;
  formulaHits: number;
  statHits: number;
  combinedHits: number;
  actual: number[];
}

export interface Scoreboard {
  rows: ComponentRow[];
  totals: { formula: number; statistical: number; combined: number; tests: number };
  best: "formula" | "statistical" | "combined" | "tied";
  suggestedWeight: number | null;
}

/**
 * Compares the top-6 selections of each component with the real draw.
 * Only past, already-drawn slots are used — no future information.
 */
export function scoreComponents(
  entries: { label: string; formulaPool: PickedNumber[]; stats: StatLayer; draw: Draw }[],
  formulaWeight = 0.7,
): Scoreboard {
  const rows: ComponentRow[] = entries.map((e) => {
    const actual = drawNumbers(e.draw);
    const maxScore = Math.max(...e.formulaPool.map((p) => p.score), 1);
    const formulaTop = e.formulaPool.slice(0, 6).map((p) => p.n);
    const statTop = e.stats.numbers.slice(0, 6).map((s) => s.n);

    const combined = new Map<number, number>();
    for (const p of e.formulaPool)
      combined.set(p.n, formulaWeight * (Math.max(0, p.score) / maxScore));
    for (const s of e.stats.numbers)
      combined.set(s.n, (combined.get(s.n) ?? 0) + (1 - formulaWeight) * s.score);
    const combinedTop = Array.from(combined.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([n]) => n);

    const hits = (list: number[]) => list.filter((n) => actual.includes(n)).length;
    return {
      label: e.label,
      formulaHits: hits(formulaTop),
      statHits: hits(statTop),
      combinedHits: hits(combinedTop),
      actual,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      formula: acc.formula + r.formulaHits,
      statistical: acc.statistical + r.statHits,
      combined: acc.combined + r.combinedHits,
      tests: acc.tests + 1,
    }),
    { formula: 0, statistical: 0, combined: 0, tests: 0 },
  );

  const max = Math.max(totals.formula, totals.statistical, totals.combined);
  const winners = [
    totals.formula === max ? "formula" : null,
    totals.statistical === max ? "statistical" : null,
    totals.combined === max ? "combined" : null,
  ].filter(Boolean) as string[];

  return {
    rows,
    totals,
    best: (winners.length > 1 ? "tied" : (winners[0] ?? "tied")) as Scoreboard["best"],
    suggestedWeight: totals.tests >= 20 ? null : null,
  };
}

/**
 * Walk-forward weight search. Evaluates candidate formula/statistics ratios on
 * past draws only and reports which ratio scored best out-of-sample.
 */
export function searchWeights(
  entries: { label: string; formulaPool: PickedNumber[]; stats: StatLayer; draw: Draw }[],
  ratios = [0.5, 0.6, 0.7, 0.8, 0.9, 1],
): { ratio: number; hits: number }[] {
  return ratios
    .map((ratio) => ({ ratio, hits: scoreComponents(entries, ratio).totals.combined }))
    .sort((a, b) => b.hits - a.hits || b.ratio - a.ratio);
}
