import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAccessContext } from "@/lib/authorization.server";
import { SESSIONS } from "@/lib/uk49";

const formulaInput = z.object({
  name: z.string().trim().min(2).max(120),
  expression: z.string().trim().min(1).max(4000),
});

type Row = Record<string, unknown>;
export type CustomerFormula = {
  id: string;
  name: string;
  expression: string;
  createdAt: string;
  updatedAt: string;
};
export type CustomerDraw = {
  draw_date: string;
  session: string;
  n1: number;
  n2: number;
  n3: number;
  n4: number;
  n5: number;
  n6: number;
  booster: number | null;
};
export type CustomerPrediction = {
  targetDate: string;
  targetSession: string;
  generatedAt: string;
  banker: number | null;
  sevenBallRanking: number[];
  pool: number[];
  hotBalls: number[];
  coldBalls: number[];
  status: string;
  actualNumbers: number[];
  actualBooster: number | null;
  matchedCount: number;
  outcome: string | null;
  gradedAt: string | null;
};
export type CustomerWheel = { number: number; score: number; agreement: number };
export type CustomerVideo = { title: string; category: string; duration: string };
export type CustomerDashboard = {
  role: "unauthenticated" | "free" | "premium" | "administrator";
  planCode: "free" | "premium" | null;
  formulaLimit: 3 | 5;
  formulas: CustomerFormula[];
  draws: CustomerDraw[];
  prediction: CustomerPrediction | null;
  predictions: CustomerPrediction[];
  wheel: CustomerWheel[];
  videos: CustomerVideo[];
  featureVisibility: {
    ledger: false;
    strategyUpload: false;
    ensemble: false;
    statisticsWheel: boolean;
    candidateDescription: false;
  };
};
export type PremiumCandidate = {
  number: number;
  score: number;
  agreement: number;
  strategies: string[];
};
export type PremiumWorkspace = {
  formulaLimit: 5;
  noAdvertisements: true;
  banker: number | null;
  prediction: {
    targetDate: string;
    targetSession: string;
    status: string;
    pool: number[];
    ranking: number[];
  } | null;
  ensemble: { candidates: PremiumCandidate[]; strategyCount: number; createdAt: string } | null;
  wheel: Array<{ number: number; score: number; agreement: number }>;
  currentDate: string | null;
  sessions: Array<{
    targetDate: string;
    targetSession: string;
    status: string;
    banker: number | null;
    pool: number[];
    actualNumbers: number[];
    actualBooster: number | null;
    matchedCount: number;
    outcome: string | null;
    ensemble: { candidates: PremiumCandidate[]; strategyCount: number; createdAt: string } | null;
  }>;
  candidateDescriptions: Array<{ number: number; rationale: string }>;
};
type QueryResult = { data: Row[] | Row | null; error: { message: string } | null };
type QueryBuilder = Promise<QueryResult> & {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: string) => QueryBuilder;
  order: (column: string, options: { ascending: boolean }) => QueryBuilder;
  limit: (count: number) => QueryBuilder;
  insert: (values: Row) => QueryBuilder;
  single: () => QueryBuilder;
};
type CustomerDb = { from: (table: string) => QueryBuilder };

/** A UK49 number 1–49, or null if the value isn't a valid one. */
function toBallNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 49
    ? value
    : null;
}

/**
 * `predictions.pool` is stored as `PickedNumber[]` (see predict.ts —
 * `{ n, score, strategies, strategyIds }`), not plain numbers. This
 * previously filtered with `typeof n === "number"`, which is false for
 * every element of that shape — pool/hotBalls/coldBalls were silently
 * empty for every user, on both the free dashboard and Premium
 * workspace, regardless of whether a prediction row existed. Also
 * accepts a plain number defensively, in case a caller ever stores a
 * flat array directly.
 */
export function asNumberArray(value: unknown, max: number): number[] {
  if (!Array.isArray(value)) return [];
  const result: number[] = [];
  for (const item of value) {
    const n =
      toBallNumber(item) ??
      (item && typeof item === "object"
        ? toBallNumber((item as Record<string, unknown>)["n"])
        : null);
    if (n !== null) result.push(n);
    if (result.length >= max) break;
  }
  return result;
}

/** Count only matches in the client-visible prediction pool. */
export function countVisibleMatches(pool: number[], actual: number[]): number {
  const visible = new Set(pool);
  return actual.filter((number) => visible.has(number)).length;
}

/**
 * `predictions.rows` is `PredictionRow[]` — each entry is a compound
 * betting-line suggestion `{ banker: PickedNumber, pair: [PickedNumber,
 * PickedNumber], bonus: PickedNumber }` (see predict.ts's
 * buildPrediction), not a single number and not directly flattenable
 * the way `asNumberArray` handles `pool`. The dashboard/premium UI
 * expects a flat, ranked, de-duplicated list of numbers (it calls
 * `.includes()` and renders each entry as one ball in ranked order —
 * see dashboard.tsx's "sevenBallRanking" usage), so this pulls
 * banker → pair partner → bonus out of each row in order, skipping
 * numbers already surfaced by an earlier (higher-ranked) row.
 */
export function flattenRowsToRanking(value: unknown, max: number): number[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const result: number[] = [];
  for (const row of value) {
    if (result.length >= max) break;
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const pair = Array.isArray(r["pair"]) ? r["pair"] : [];
    const candidates = [
      toBallNumber(
        r["banker"] && typeof r["banker"] === "object"
          ? (r["banker"] as Record<string, unknown>)["n"]
          : null,
      ),
      toBallNumber(
        pair[1] && typeof pair[1] === "object" ? (pair[1] as Record<string, unknown>)["n"] : null,
      ),
      toBallNumber(
        r["bonus"] && typeof r["bonus"] === "object"
          ? (r["bonus"] as Record<string, unknown>)["n"]
          : null,
      ),
    ];
    for (const n of candidates) {
      if (n !== null && !seen.has(n) && result.length < max) {
        seen.add(n);
        result.push(n);
      }
    }
  }
  return result;
}
function asCandidates(value: unknown): PremiumCandidate[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const number = Number(row["number"]);
    if (!Number.isInteger(number) || number < 1 || number > 49) return [];
    return [
      {
        number,
        score: Number(row["score"] ?? 0),
        agreement: Number(row["agreement"] ?? 0),
        strategies: Array.isArray(row["strategies"])
          ? row["strategies"].filter((s): s is string => typeof s === "string").slice(0, 5)
          : [],
      },
    ];
  });
}

function asActual(value: unknown): { numbers: number[]; booster: number | null } {
  if (!value || typeof value !== "object") return { numbers: [], booster: null };
  const row = value as Record<string, unknown>;
  return { numbers: asNumberArray(row["numbers"], 6), booster: toBallNumber(row["booster"]) };
}

function toCustomerPrediction(row: Row | null | undefined): CustomerPrediction | null {
  if (!row) return null;
  const actual = asActual(row["actual"]);
  const pool = asNumberArray(row["pool"], 14);
  return {
    targetDate: String(row["target_date"]),
    targetSession: String(row["target_session"]),
    generatedAt: String(row["generated_at"]),
    banker: typeof row["banker"] === "number" ? row["banker"] : null,
    sevenBallRanking: flattenRowsToRanking(row["rows"], 7),
    pool,
    hotBalls: pool.slice(0, 5),
    coldBalls: pool.slice(-5),
    status: String(row["status"] ?? "pending"),
    actualNumbers: actual.numbers,
    actualBooster: actual.booster,
    matchedCount: countVisibleMatches(pool, actual.numbers),
    outcome: typeof row["outcome"] === "string" ? row["outcome"] : null,
    gradedAt: typeof row["graded_at"] === "string" ? row["graded_at"] : null,
  };
}

function sortPredictions(rows: CustomerPrediction[]) {
  return rows.sort((a, b) => {
    if (a.targetDate !== b.targetDate) return a.targetDate < b.targetDate ? 1 : -1;
    return (
      SESSIONS.indexOf(a.targetSession as (typeof SESSIONS)[number]) -
      SESSIONS.indexOf(b.targetSession as (typeof SESSIONS)[number])
    );
  });
}

function formulaLimit(role: string) {
  return role === "premium" || role === "administrator" ? 5 : 3;
}

export const getAccessContext = createServerFn({ method: "GET" })
  .middleware([requireAccessContext])
  .handler(async ({ context }) => context.accessContext);

export const getCustomerDashboard = createServerFn({ method: "GET" })
  .middleware([requireAccessContext])
  .handler(async ({ context }): Promise<CustomerDashboard> => {
    const { accessContext } = context;
    if (!accessContext.workspaceId)
      return {
        role: accessContext.role,
        planCode: accessContext.planCode,
        formulaLimit: formulaLimit(accessContext.role),
        formulas: [],
        draws: [],
        prediction: null,
        predictions: [],
        wheel: [],
        videos: [],
        featureVisibility: {
          ledger: false,
          strategyUpload: false,
          ensemble: false,
          statisticsWheel: true,
          candidateDescription: false,
        },
      };
    const db = context.supabase as unknown as CustomerDb;
    const [
      { data: draws, error: drawsError },
      { data: predictions, error: predictionError },
      { data: formulas, error: formulasError },
      { data: analyses, error: analysisError },
    ] = await Promise.all([
      db
        .from("draws")
        .select("draw_date,session,n1,n2,n3,n4,n5,n6,booster")
        .order("draw_date", { ascending: false })
        .limit(8),
      db
        .from("predictions")
        .select(
          "target_date,target_session,generated_at,banker,pool,rows,status,actual,matched_count,outcome,graded_at",
        )
        .order("target_date", { ascending: false }),
      db
        .from("workspace_formulas")
        .select("id,name,expression,created_at,updated_at")
        .eq("workspace_id", accessContext.workspaceId)
        .order("created_at", { ascending: false }),
      db
        .from("analysis_runs")
        .select("top_numbers")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    if (drawsError) throw new Error(`Failed to load draw results: ${drawsError.message}`);
    if (predictionError)
      throw new Error(`Failed to load prediction summary: ${predictionError.message}`);
    if (formulasError) throw new Error(`Failed to load private formulas: ${formulasError.message}`);
    if (analysisError) throw new Error(`Failed to load dashboard wheel: ${analysisError.message}`);
    const drawRows: CustomerDraw[] = (Array.isArray(draws) ? draws : []).map((draw) => ({
      draw_date: String(draw["draw_date"]),
      session: String(draw["session"]),
      n1: Number(draw["n1"]),
      n2: Number(draw["n2"]),
      n3: Number(draw["n3"]),
      n4: Number(draw["n4"]),
      n5: Number(draw["n5"]),
      n6: Number(draw["n6"]),
      booster: typeof draw["booster"] === "number" ? draw["booster"] : null,
    }));
    const predictionRows = Array.isArray(predictions) ? predictions : [];
    const formulaRows = Array.isArray(formulas) ? formulas : [];
    const customerPredictions = sortPredictions(
      predictionRows.flatMap((row) => {
        const prediction = toCustomerPrediction(row);
        return prediction ? [prediction] : [];
      }),
    );
    const prediction = customerPredictions[0] ?? null;
    const analysisRows = Array.isArray(analyses) ? analyses : [];
    const wheel = asCandidates(analysisRows[0]?.["top_numbers"]).map(
      ({ number, score, agreement }) => ({
        number,
        score,
        agreement,
      }),
    );
    return {
      role: accessContext.role,
      planCode: accessContext.planCode ?? "free",
      formulaLimit: formulaLimit(accessContext.role),
      formulas: formulaRows.map((formula) => ({
        id: String(formula["id"]),
        name: String(formula["name"]),
        expression: String(formula["expression"]),
        createdAt: String(formula["created_at"]),
        updatedAt: String(formula["updated_at"]),
      })),
      draws: drawRows,
      prediction,
      predictions: customerPredictions,
      wheel,
      videos: [
        { title: "Reading your 14-ball pool", category: "Getting started", duration: "02:18" },
        { title: "How to interpret hot and cold balls", category: "Method", duration: "03:42" },
        {
          title: "Using your prediction responsibly",
          category: "Product guide",
          duration: "01:56",
        },
      ],
      featureVisibility: {
        ledger: false,
        strategyUpload: false,
        ensemble: false,
        statisticsWheel: true,
        candidateDescription: false,
      },
    };
  });

export const saveCustomerFormula = createServerFn({ method: "POST" })
  .middleware([requireAccessContext])
  .inputValidator((input: unknown) => formulaInput.parse(input))
  .handler(async ({ context, data }) => {
    const { accessContext } = context;
    if (!accessContext.workspaceId)
      throw new Error("Workspace is not ready. Sign in again to initialize it.");
    const db = context.supabase as unknown as CustomerDb;
    const existing = await db
      .from("workspace_formulas")
      .select("id")
      .eq("workspace_id", accessContext.workspaceId);
    if (existing.error) throw new Error(`Failed to check formula limit: ${existing.error.message}`);
    const limit = formulaLimit(accessContext.role);
    const existingRows = Array.isArray(existing.data) ? existing.data : [];
    if (existingRows.length >= limit)
      throw new Error(
        `Your ${accessContext.role === "premium" ? "Premium" : "Free"} workspace allows ${limit} formulas.`,
      );
    const result = await db
      .from("workspace_formulas")
      .insert({
        workspace_id: accessContext.workspaceId,
        name: data.name,
        expression: data.expression,
      })
      .select("id,name,expression,created_at,updated_at")
      .single();
    if (result.error) throw new Error(`Failed to save private formula: ${result.error.message}`);
    const saved = result.data && !Array.isArray(result.data) ? result.data : null;
    return saved
      ? {
          id: String(saved["id"]),
          name: String(saved["name"]),
          expression: String(saved["expression"]),
          createdAt: String(saved["created_at"]),
          updatedAt: String(saved["updated_at"]),
        }
      : null;
  });

export const getPremiumWorkspace = createServerFn({ method: "GET" })
  .middleware([requireAccessContext])
  .handler(async ({ context }): Promise<PremiumWorkspace> => {
    if (context.accessContext.role !== "premium" && context.accessContext.role !== "administrator")
      throw new Error("Premium membership required.");
    const db = context.supabase as unknown as CustomerDb;
    const [
      { data: predictions, error: predictionError },
      { data: analyses, error: analysisError },
    ] = await Promise.all([
      db
        .from("predictions")
        .select(
          "target_date,target_session,status,banker,pool,rows,actual,matched_count,outcome,generated_at",
        )
        .order("target_date", { ascending: false }),
      db
        .from("analysis_runs")
        .select("target_date,target_session,top_numbers,strategy_count,created_at")
        .order("target_date", { ascending: false }),
    ]);
    if (predictionError)
      throw new Error(`Failed to load Premium prediction: ${predictionError.message}`);
    if (analysisError) throw new Error(`Failed to load Premium analysis: ${analysisError.message}`);
    const predictionRows = Array.isArray(predictions) ? predictions : [];
    const analysisRows = Array.isArray(analyses) ? analyses : [];
    const orderedPredictions = predictionRows.slice().sort((a, b) => {
      const dateOrder = String(b["target_date"]).localeCompare(String(a["target_date"]));
      if (dateOrder !== 0) return dateOrder;
      return (
        SESSIONS.indexOf(String(a["target_session"]) as (typeof SESSIONS)[number]) -
        SESSIONS.indexOf(String(b["target_session"]) as (typeof SESSIONS)[number])
      );
    });
    const sessionRows = orderedPredictions.map((row) => {
      const analysis = analysisRows.find(
        (candidate) =>
          String(candidate["target_date"]) === String(row["target_date"]) &&
          String(candidate["target_session"]) === String(row["target_session"]),
      );
      const actual = asActual(row["actual"]);
      return {
        targetDate: String(row["target_date"]),
        targetSession: String(row["target_session"]),
        status: String(row["status"] ?? "pending"),
        banker: typeof row["banker"] === "number" ? row["banker"] : null,
        pool: asNumberArray(row["pool"], 14),
        actualNumbers: actual.numbers,
        actualBooster: actual.booster,
        matchedCount: countVisibleMatches(asNumberArray(row["pool"], 14), actual.numbers),
        outcome: typeof row["outcome"] === "string" ? row["outcome"] : null,
        ensemble: analysis
          ? {
              candidates: asCandidates(analysis["top_numbers"]),
              strategyCount: Number(analysis["strategy_count"] ?? 0),
              createdAt: String(analysis["created_at"]),
            }
          : null,
      };
    });
    const latest = sessionRows[0] ?? null;
    const latestAnalysis = latest
      ? sessionRows.find(
          (row) =>
            row.targetDate === latest.targetDate && row.targetSession === latest.targetSession,
        )?.ensemble
      : null;
    const candidates = latestAnalysis?.candidates ?? [];
    const prediction = latest;
    const pool = latest?.pool ?? [];
    const ranking = latest ? flattenRowsToRanking(orderedPredictions[0]?.["rows"], 7) : [];
    return {
      formulaLimit: 5,
      noAdvertisements: true,
      banker: typeof prediction?.["banker"] === "number" ? prediction["banker"] : null,
      prediction: prediction
        ? {
            targetDate: prediction.targetDate,
            targetSession: prediction.targetSession,
            status: prediction.status,
            pool,
            ranking,
          }
        : null,
      ensemble: latestAnalysis ?? null,
      wheel: candidates.map((candidate) => ({
        number: candidate.number,
        score: candidate.score,
        agreement: candidate.agreement,
      })),
      currentDate: latest?.targetDate ?? null,
      sessions: sessionRows,
      candidateDescriptions: candidates.slice(0, 7).map((candidate) => ({
        number: candidate.number,
        rationale:
          candidate.agreement > 0
            ? `${candidate.agreement} strategy signals agree on this candidate.`
            : "Candidate retained in the latest stored analysis snapshot.",
      })),
    };
  });

// Narrow RPC surface for claim_early_bird_premium -- not in the
// generated Supabase types (predates this migration), same reasoning
// as the other narrow RPC types in this codebase.
type EarlyBirdClaimDb = {
  rpc: (fn: "claim_early_bird_premium") => Promise<{
    data: { already_claimed: boolean; claimed: boolean } | null;
    error: { message: string } | null;
  }>;
};

/**
 * Claims one of the first 1,000 early-bird Premium slots for the caller's
 * own workspace, if any remain. No billing provider is connected yet
 * (see premium.tsx), so this is an honest direct entitlement grant --
 * not a discount applied through checkout, since there is no checkout.
 * Idempotent: calling it again after a successful claim just returns
 * already_claimed: true.
 */
export const claimEarlyBirdPremium = createServerFn({ method: "POST" })
  .middleware([requireAccessContext])
  .handler(async ({ context }): Promise<{ alreadyClaimed: boolean; claimed: boolean }> => {
    const { data, error } = await (context.supabase as unknown as EarlyBirdClaimDb).rpc(
      "claim_early_bird_premium",
    );
    if (error) throw new Error(error.message);
    return { alreadyClaimed: data?.already_claimed ?? false, claimed: data?.claimed ?? false };
  });
