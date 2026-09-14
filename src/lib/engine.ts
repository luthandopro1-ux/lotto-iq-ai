import {
  SESSIONS,
  drawNumbers,
  normalize,
  type Draw,
  type SessionKey,
  type Strategy,
} from "./uk49";

/** A single produced number together with the working that created it. */
export interface RuleOutput {
  value: number;
  trace: string;
}

export interface RuleContext {
  date: Date;
  session: SessionKey;
  /** Most recent draws, newest first, excluding the target draw. */
  history: Draw[];
  /** The three draws immediately before the target draw (may be shorter). */
  previousThree: Draw[];
  params: Record<string, unknown>;
}

export interface RuleDefinition {
  type: string;
  label: string;
  explain: string;
  category: "date" | "digit" | "history" | "custom";
  run: (ctx: RuleContext) => (RuleOutput | number)[];
}

const digits = (n: number) => String(Math.abs(n)).split("").map(Number);
const seedDraw = (ctx: RuleContext) => ctx.previousThree[0] ?? ctx.history[0];
const seedNumbers = (ctx: RuleContext) => {
  const d = seedDraw(ctx);
  return d ? drawNumbers(d) : [];
};
const out = (value: number, trace: string): RuleOutput => ({ value, trace });

/**
 * Rule registry. Adding a new rule type = one `register()` call.
 * No existing code needs to change.
 */
const registry = new Map<string, RuleDefinition>();

export function register(rule: RuleDefinition) {
  registry.set(rule.type, rule);
}

export const getRule = (type: string) => registry.get(type);
export const allRules = () => Array.from(registry.values());

register({
  type: "date_x_number",
  label: "Date × Number",
  explain: "Multiplies the day of month by each number of the previous draw.",
  category: "date",
  run: (ctx) =>
    seedNumbers(ctx).map((n) =>
      out(
        n * ctx.date.getDate(),
        `${n} × ${ctx.date.getDate()} (date) = ${n * ctx.date.getDate()}`,
      ),
    ),
});

register({
  type: "date_x_constant",
  label: "Date × Constant",
  explain: "Multiplies the day of month by a fixed multiplier (default 27).",
  category: "date",
  run: (ctx) => {
    const k = Number(ctx.params["multiplier"] ?? 27) || 27;
    const day = ctx.date.getDate();
    const base = day * k;
    return [
      out(base, `${day} (date) × ${k} = ${base}`),
      out(base + k, `${base} + ${k} = ${base + k}`),
      out(Math.round(base / 2), `${base} ÷ 2 = ${Math.round(base / 2)}`),
    ];
  },
});

register({
  type: "fifty_minus_date",
  label: "50 − Date",
  explain: "Subtracts the day of month from 50, then blends with the last draw.",
  category: "date",
  run: (ctx) => {
    const day = ctx.date.getDate();
    const base = 50 - day;
    return [
      out(base, `50 − ${day} (date) = ${base}`),
      ...seedNumbers(ctx).map((n) =>
        out(Math.abs(n - base), `|${n} − ${base}| = ${Math.abs(n - base)}`),
      ),
    ];
  },
});

register({
  type: "date_time_49",
  label: "Date × Time × 49",
  explain: "Day of month × session index × 49, folded into range.",
  category: "date",
  run: (ctx) => {
    const t = SESSIONS.indexOf(ctx.session) + 1;
    const day = ctx.date.getDate();
    const base = day * t * 49;
    return [
      out(base, `${day} × ${t} (session) × 49 = ${base}`),
      out(Math.round(base / 7), `${base} ÷ 7 = ${Math.round(base / 7)}`),
      out(base + t, `${base} + ${t} = ${base + t}`),
      out(day * t, `${day} × ${t} = ${day * t}`),
    ];
  },
});

register({
  type: "split_numbers",
  label: "Split Numbers",
  explain: "Splits two-digit numbers into their separate digits.",
  category: "digit",
  run: (ctx) =>
    seedNumbers(ctx).flatMap((n) =>
      n > 9 ? digits(n).map((d) => out(d, `${n} split → ${d}`)) : [out(n, `${n} kept`)],
    ),
});

register({
  type: "reverse_numbers",
  label: "Reverse Numbers",
  explain: "Reverses the digits of each previous number.",
  category: "digit",
  run: (ctx) =>
    seedNumbers(ctx).map((n) => {
      const r = Number(String(n).split("").reverse().join(""));
      return out(r, `${n} reversed = ${r}`);
    }),
});

register({
  type: "add_digits",
  label: "Add Digits",
  explain: "Adds the digits of each previous number together.",
  category: "digit",
  run: (ctx) =>
    seedNumbers(ctx).map((n) => {
      const s = digits(n).reduce((a, b) => a + b, 0);
      return out(s, `${digits(n).join(" + ")} = ${s}`);
    }),
});

register({
  type: "multiply_digits",
  label: "Multiply Digits",
  explain: "Multiplies the digits of each previous number.",
  category: "digit",
  run: (ctx) =>
    seedNumbers(ctx).map((n) => {
      const p = digits(n).reduce((a, b) => a * (b || 1), 1);
      return out(p, `${digits(n).join(" × ")} = ${p}`);
    }),
});

register({
  type: "sum_six",
  label: "Sum Six Numbers",
  explain: "Sum of the previous six numbers, plus derived variants.",
  category: "history",
  run: (ctx) => {
    const nums = seedNumbers(ctx);
    const s = nums.reduce((a, b) => a + b, 0);
    if (!s) return [];
    return [
      out(s, `sum(${nums.join(", ")}) = ${s}`),
      out(Math.round(s / 2), `${s} ÷ 2 = ${Math.round(s / 2)}`),
      out(Math.round(s / 6), `${s} ÷ 6 = ${Math.round(s / 6)}`),
      out(Math.abs(s - 49), `|${s} − 49| = ${Math.abs(s - 49)}`),
    ];
  },
});

register({
  type: "minus_booster",
  label: "Minus Booster",
  explain: "Each previous number minus the booster ball.",
  category: "history",
  run: (ctx) => {
    const prev = seedDraw(ctx);
    if (!prev?.booster) return [];
    const b = prev.booster;
    return drawNumbers(prev).map((n) =>
      out(Math.abs(n - b), `|${n} − ${b}| (booster) = ${Math.abs(n - b)}`),
    );
  },
});

register({
  type: "previous_draw",
  label: "Previous Draw Analysis",
  explain: "Neighbours (±1, ±7) of every number in the previous draw.",
  category: "history",
  run: (ctx) =>
    seedNumbers(ctx).flatMap((n) => [
      out(n + 1, `${n} + 1 = ${n + 1}`),
      out(n - 1, `${n} − 1 = ${n - 1}`),
      out(n + 7, `${n} + 7 = ${n + 7}`),
      out(n - 7, `${n} − 7 = ${n - 7}`),
    ]),
});

register({
  type: "previous_three",
  label: "Previous Three Draw Analysis",
  explain:
    "Repeats across the last three draws, position gaps between them, and mirrors of the repeats.",
  category: "history",
  run: (ctx) => {
    const three = ctx.previousThree.slice(0, 3);
    if (three.length === 0) return [];
    const grids = three.map(drawNumbers);
    const counts = new Map<number, number>();
    grids.flat().forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1));

    const results: RuleOutput[] = [];
    for (const [n, c] of counts) {
      if (c > 1) results.push(out(n, `${n} appeared in ${c} of the last ${three.length} draws`));
    }
    if (grids.length >= 2) {
      grids[0]!.forEach((n, i) => {
        const p = grids[1]![i]!;
        results.push(out(Math.abs(n - p), `|${n} − ${p}| across draws 1→2 = ${Math.abs(n - p)}`));
      });
    }
    if (grids.length >= 3) {
      grids[0]!.forEach((n, i) => {
        const p = grids[2]![i]!;
        results.push(out(Math.abs(n - p), `|${n} − ${p}| across draws 1→3 = ${Math.abs(n - p)}`));
      });
    }
    return results;
  },
});

register({
  type: "three_draw_sum",
  label: "Three Draw Sum Cycle",
  explain: "Sums each of the last three draws and folds the totals into range.",
  category: "history",
  run: (ctx) => {
    const three = ctx.previousThree.slice(0, 3);
    const results: RuleOutput[] = [];
    three.forEach((d, i) => {
      const nums = drawNumbers(d);
      const s = nums.reduce((a, b) => a + b, 0);
      results.push(out(s, `draw −${i + 1} sum ${nums.join("+")} = ${s}`));
    });
    if (three.length >= 2) {
      const totals = three.map((d) => drawNumbers(d).reduce((a, b) => a + b, 0));
      const total = totals.reduce((a, b) => a + b, 0);
      results.push(out(total, `combined sum ${totals.join(" + ")} = ${total}`));
      results.push(
        out(
          Math.round(total / three.length),
          `average of last ${three.length} sums = ${Math.round(total / three.length)}`,
        ),
      );
    }
    return results;
  },
});

register({
  type: "mirror_numbers",
  label: "Mirror Numbers",
  explain: "Mirrors each previous number around 50.",
  category: "digit",
  run: (ctx) => seedNumbers(ctx).map((n) => out(50 - n, `50 − ${n} = ${50 - n}`)),
});

/* ------------------------------------------------------------------ */
/* Visual Strategy Builder rule                                        */
/* ------------------------------------------------------------------ */

export type BuilderSeed =
  "prev1" | "prev2" | "prev3" | "prev3_all" | "date" | "booster" | "sum_prev1";

export type BuilderOpType =
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "modulo"
  | "add_date"
  | "multiply_date"
  | "subtract_from"
  | "mirror"
  | "reverse"
  | "split"
  | "sum_digits"
  | "multiply_digits"
  | "neighbours";

export interface BuilderOp {
  op: BuilderOpType;
  value?: number;
}

export const BUILDER_SEEDS: { id: BuilderSeed; label: string }[] = [
  { id: "prev1", label: "Previous draw numbers" },
  { id: "prev2", label: "Draw before that" },
  { id: "prev3", label: "Three draws back" },
  { id: "prev3_all", label: "All of the last three draws" },
  { id: "date", label: "Day of month" },
  { id: "booster", label: "Previous booster" },
  { id: "sum_prev1", label: "Sum of previous draw" },
];

export const BUILDER_OPS: { id: BuilderOpType; label: string; needsValue: boolean }[] = [
  { id: "add", label: "Add", needsValue: true },
  { id: "subtract", label: "Subtract", needsValue: true },
  { id: "multiply", label: "Multiply by", needsValue: true },
  { id: "divide", label: "Divide by", needsValue: true },
  { id: "modulo", label: "Modulo", needsValue: true },
  { id: "add_date", label: "Add day of month", needsValue: false },
  { id: "multiply_date", label: "Multiply by day of month", needsValue: false },
  { id: "subtract_from", label: "Subtract from", needsValue: true },
  { id: "mirror", label: "Mirror around 50", needsValue: false },
  { id: "reverse", label: "Reverse digits", needsValue: false },
  { id: "split", label: "Split digits", needsValue: false },
  { id: "sum_digits", label: "Add digits", needsValue: false },
  { id: "multiply_digits", label: "Multiply digits", needsValue: false },
  { id: "neighbours", label: "Neighbours ±1", needsValue: false },
];

function buildSeed(seed: BuilderSeed, ctx: RuleContext): RuleOutput[] {
  const draw = (i: number) => ctx.previousThree[i] ?? ctx.history[i];
  switch (seed) {
    case "prev2":
      return draw(1) ? drawNumbers(draw(1)!).map((n) => out(n, `${n} (draw −2)`)) : [];
    case "prev3":
      return draw(2) ? drawNumbers(draw(2)!).map((n) => out(n, `${n} (draw −3)`)) : [];
    case "prev3_all":
      return ctx.previousThree
        .slice(0, 3)
        .flatMap((d, i) => drawNumbers(d).map((n) => out(n, `${n} (draw −${i + 1})`)));
    case "date":
      return [out(ctx.date.getDate(), `${ctx.date.getDate()} (day of month)`)];
    case "booster": {
      const b = draw(0)?.booster;
      return b ? [out(b, `${b} (booster)`)] : [];
    }
    case "sum_prev1": {
      const d = draw(0);
      if (!d) return [];
      const s = drawNumbers(d).reduce((a, b) => a + b, 0);
      return [out(s, `sum of previous draw = ${s}`)];
    }
    case "prev1":
    default:
      return draw(0) ? drawNumbers(draw(0)!).map((n) => out(n, `${n} (draw −1)`)) : [];
  }
}

function applyOp(item: RuleOutput, step: BuilderOp, ctx: RuleContext): RuleOutput[] {
  const v = Number(step.value ?? 0);
  const day = ctx.date.getDate();
  const make = (value: number, label: string) => out(value, `${item.trace} → ${label}`);

  switch (step.op) {
    case "add":
      return [make(item.value + v, `+ ${v} = ${item.value + v}`)];
    case "subtract":
      return [make(item.value - v, `− ${v} = ${item.value - v}`)];
    case "multiply":
      return [make(item.value * v, `× ${v} = ${item.value * v}`)];
    case "divide":
      return v ? [make(Math.round(item.value / v), `÷ ${v} = ${Math.round(item.value / v)}`)] : [];
    case "modulo":
      return v ? [make(item.value % v, `mod ${v} = ${item.value % v}`)] : [];
    case "add_date":
      return [make(item.value + day, `+ ${day} (date) = ${item.value + day}`)];
    case "multiply_date":
      return [make(item.value * day, `× ${day} (date) = ${item.value * day}`)];
    case "subtract_from":
      return [make(v - item.value, `${v} − value = ${v - item.value}`)];
    case "mirror":
      return [make(50 - item.value, `mirror = ${50 - item.value}`)];
    case "reverse": {
      const r = Number(String(Math.abs(item.value)).split("").reverse().join(""));
      return [make(r, `reversed = ${r}`)];
    }
    case "split":
      return digits(item.value).map((d) => make(d, `split digit ${d}`));
    case "sum_digits": {
      const s = digits(item.value).reduce((a, b) => a + b, 0);
      return [make(s, `digit sum = ${s}`)];
    }
    case "multiply_digits": {
      const p = digits(item.value).reduce((a, b) => a * (b || 1), 1);
      return [make(p, `digit product = ${p}`)];
    }
    case "neighbours":
      return [
        make(item.value + 1, `+1 = ${item.value + 1}`),
        make(item.value - 1, `−1 = ${item.value - 1}`),
      ];
    default:
      return [item];
  }
}

register({
  type: "builder",
  label: "Custom Formula (Builder)",
  explain: "A user-built chain of operations applied to a chosen starting set.",
  category: "custom",
  run: (ctx) => {
    const seed = (ctx.params["seed"] as BuilderSeed) ?? "prev1";
    const steps = Array.isArray(ctx.params["steps"]) ? (ctx.params["steps"] as BuilderOp[]) : [];
    let current = buildSeed(seed, ctx);
    for (const step of steps) {
      current = current.flatMap((item) => applyOp(item, step, ctx)).slice(0, 200);
    }
    return current;
  },
});

/** Human-readable summary of a builder strategy's formula. */
export function describeBuilder(params: Record<string, unknown>): string {
  const seed = BUILDER_SEEDS.find((s) => s.id === (params["seed"] ?? "prev1"));
  const steps = Array.isArray(params["steps"]) ? (params["steps"] as BuilderOp[]) : [];
  const parts = steps.map((s) => {
    const def = BUILDER_OPS.find((o) => o.id === s.op);
    return def?.needsValue ? `${def.label} ${s.value ?? 0}` : (def?.label ?? s.op);
  });
  return [seed?.label ?? "Previous draw numbers", ...parts].join(" → ");
}

/* ------------------------------------------------------------------ */
/* Analysis                                                            */
/* ------------------------------------------------------------------ */

export interface StrategyHit {
  strategyId: string;
  strategy: string;
  weight: number;
  traces: string[];
}

export interface ScoredNumber {
  number: number;
  /** Weighted agreement score. */
  score: number;
  /** How many distinct strategies produced this number. */
  agreement: number;
  hits: StrategyHit[];
}

export interface StrategyOutput {
  strategy: Strategy;
  numbers: number[];
  traces: Record<number, string[]>;
  error?: string;
}

export interface AnalysisResult {
  perStrategy: StrategyOutput[];
  ranked: ScoredNumber[];
}

function toOutputs(raw: (RuleOutput | number)[]): RuleOutput[] {
  return raw.map((r) => (typeof r === "number" ? { value: r, trace: `${r}` } : r));
}

/**
 * Runs every strategy independently, normalises each output to 1-49
 * and combines them into a weighted agreement ranking.
 */
export function runAnalysis(
  strategies: Strategy[],
  ctx: Omit<RuleContext, "params">,
): AnalysisResult {
  const perStrategy: StrategyOutput[] = [];
  const scores = new Map<number, ScoredNumber>();

  for (const s of strategies) {
    const rule = registry.get(s.rule_type);
    if (!rule) {
      perStrategy.push({
        strategy: s,
        numbers: [],
        traces: {},
        error: `Unknown rule "${s.rule_type}"`,
      });
      continue;
    }

    const traces: Record<number, string[]> = {};
    const numbers: number[] = [];
    let error: string | undefined;

    try {
      for (const item of toOutputs(rule.run({ ...ctx, params: s.params ?? {} }))) {
        const n = normalize(item.value);
        if (n === null) continue;
        if (!traces[n]) {
          traces[n] = [];
          numbers.push(n);
        }
        if (traces[n]!.length < 4) {
          traces[n]!.push(item.value === n ? item.trace : `${item.trace} → folds to ${n}`);
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Strategy failed to run";
    }

    numbers.sort((a, b) => a - b);
    perStrategy.push({ strategy: s, numbers, traces, ...(error ? { error } : {}) });

    const weight = Number(s.weight) || 1;
    for (const n of numbers) {
      const entry = scores.get(n) ?? { number: n, score: 0, agreement: 0, hits: [] };
      entry.score += weight;
      entry.agreement += 1;
      entry.hits.push({ strategyId: s.id, strategy: s.name, weight, traces: traces[n] ?? [] });
      scores.set(n, entry);
    }
  }

  const ranked = Array.from(scores.values()).sort(
    (a, b) => b.score - a.score || b.agreement - a.agreement || a.number - b.number,
  );
  return { perStrategy, ranked };
}

export { normalize };

/* ------------------------------------------------------------------ */
/* Ranked pairs engine                                                 */
/* ------------------------------------------------------------------ */

export interface RankedPair {
  pair: [number, number];
  /** Combined score: strategy agreement + historical co-occurrence. */
  score: number;
  /** Sum of the two numbers' weighted agreement scores. */
  strategyScore: number;
  /** How many strategies produced BOTH numbers of the pair. */
  sharedStrategies: number;
  /** Names of the strategies that produced both numbers. */
  sharedStrategyNames: string[];
  /** Times the two numbers appeared together in the same historical draw. */
  coOccurrences: number;
  /** Co-occurrence rate across the history window (0-1). */
  coOccurrenceRate: number;
}

export interface PairOptions {
  /** How many top candidates to pair up. Default 12. */
  poolSize?: number;
  /** How many pairs to return. Default 5. */
  limit?: number;
  /** Weight applied to the historical co-occurrence component. Default 6. */
  historyWeight?: number;
  /** Bonus per strategy that produced both numbers. Default 1.5. */
  sharedBonus?: number;
}

/**
 * Builds the top number pairs from the ranked candidates.
 * Score = combined strategy agreement
 *       + bonus for strategies producing BOTH numbers
 *       + historical co-occurrence rate of the pair.
 */
export function rankPairs(
  ranked: ScoredNumber[],
  history: Draw[],
  options: PairOptions = {},
): RankedPair[] {
  const poolSize = options.poolSize ?? 12;
  const limit = options.limit ?? 5;
  const historyWeight = options.historyWeight ?? 6;
  const sharedBonus = options.sharedBonus ?? 1.5;

  const pool = ranked.slice(0, poolSize);
  if (pool.length < 2) return [];

  // Historical co-occurrence counts, keyed "a-b" with a < b.
  const co = new Map<string, number>();
  for (const d of history) {
    const nums = drawNumbers(d).filter((n) => Number.isFinite(n));
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const a = Math.min(nums[i]!, nums[j]!);
        const b = Math.max(nums[i]!, nums[j]!);
        const k = `${a}-${b}`;
        co.set(k, (co.get(k) ?? 0) + 1);
      }
    }
  }

  const denom = Math.max(history.length, 1);
  const pairs: RankedPair[] = [];

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const x = pool[i]!;
      const y = pool[j]!;
      const a = Math.min(x.number, y.number);
      const b = Math.max(x.number, y.number);

      const yIds = new Set(y.hits.map((h) => h.strategyId));
      const shared = x.hits.filter((h) => yIds.has(h.strategyId));
      const sharedNames = Array.from(new Set(shared.map((h) => h.strategy)));

      const coCount = co.get(`${a}-${b}`) ?? 0;
      const rate = coCount / denom;
      const strategyScore = x.score + y.score;
      const score = strategyScore + sharedNames.length * sharedBonus + rate * historyWeight;

      pairs.push({
        pair: [a, b],
        score,
        strategyScore,
        sharedStrategies: sharedNames.length,
        sharedStrategyNames: sharedNames,
        coOccurrences: coCount,
        coOccurrenceRate: rate,
      });
    }
  }

  return pairs
    .sort(
      (p, q) =>
        q.score - p.score ||
        q.sharedStrategies - p.sharedStrategies ||
        q.coOccurrences - p.coOccurrences ||
        p.pair[0] - q.pair[0],
    )
    .slice(0, limit);
}
