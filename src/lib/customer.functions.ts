import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAccessContext } from "@/lib/authorization.server";

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
};
export type CustomerVideo = { title: string; category: string; duration: string };
export type CustomerDashboard = {
  role: "unauthenticated" | "free" | "premium" | "administrator";
  planCode: "free" | "premium" | null;
  formulaLimit: 3 | 5;
  formulas: CustomerFormula[];
  draws: CustomerDraw[];
  prediction: CustomerPrediction | null;
  videos: CustomerVideo[];
  featureVisibility: {
    ledger: false;
    strategyUpload: false;
    ensemble: false;
    statisticsWheel: false;
    candidateDescription: false;
  };
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
type CustomerDb = {
  from: (table: string) => QueryBuilder;
};

function asNumberArray(value: unknown, max: number): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 49)
    .slice(0, max);
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
    if (!accessContext.workspaceId) {
      return {
        role: accessContext.role,
        planCode: accessContext.planCode,
        formulaLimit: formulaLimit(accessContext.role),
        formulas: [],
        draws: [],
        prediction: null,
        videos: [],
        featureVisibility: {
          ledger: false,
          strategyUpload: false,
          ensemble: false,
          statisticsWheel: false,
          candidateDescription: false,
        },
      };
    }

    const db = context.supabase as unknown as CustomerDb;
    const [
      { data: draws, error: drawsError },
      { data: predictions, error: predictionError },
      { data: formulas, error: formulasError },
    ] = await Promise.all([
      db
        .from("draws")
        .select("draw_date,session,n1,n2,n3,n4,n5,n6,booster")
        .order("draw_date", { ascending: false })
        .limit(8),
      db
        .from("predictions")
        .select("target_date,target_session,generated_at,banker,pool,rows,status")
        .order("generated_at", { ascending: false })
        .limit(1),
      db
        .from("workspace_formulas")
        .select("id,name,expression,created_at,updated_at")
        .eq("workspace_id", accessContext.workspaceId)
        .order("created_at", { ascending: false }),
    ]);
    if (drawsError) throw new Error(`Failed to load draw results: ${drawsError.message}`);
    if (predictionError)
      throw new Error(`Failed to load prediction summary: ${predictionError.message}`);
    if (formulasError) throw new Error(`Failed to load private formulas: ${formulasError.message}`);

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
    const prediction = (predictionRows[0] ?? null) as Row | null;
    const rows = prediction ? asNumberArray(prediction["rows"], 7) : [];
    const pool = prediction ? asNumberArray(prediction["pool"], 14) : [];
    const hotBalls = pool.slice(0, 5);
    const coldBalls = pool.slice(-5);

    return {
      role: accessContext.role,
      planCode: accessContext.planCode ?? "free",
      formulaLimit: formulaLimit(accessContext.role),
      formulas: formulaRows.map((formula: Row) => ({
        id: String(formula["id"]),
        name: String(formula["name"]),
        expression: String(formula["expression"]),
        createdAt: String(formula["created_at"]),
        updatedAt: String(formula["updated_at"]),
      })),
      draws: drawRows,
      prediction: prediction
        ? {
            targetDate: String(prediction["target_date"]),
            targetSession: String(prediction["target_session"]),
            generatedAt: String(prediction["generated_at"]),
            banker: typeof prediction["banker"] === "number" ? prediction["banker"] : null,
            sevenBallRanking: rows,
            pool,
            hotBalls,
            coldBalls,
            status: String(prediction["status"] ?? "pending"),
          }
        : null,
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
        statisticsWheel: false,
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
  .handler(async ({ context }) => {
    if (context.accessContext.role !== "premium" && context.accessContext.role !== "administrator")
      throw new Error("Premium membership required.");
    return {
      banker: null,
      ensemble: [],
      wheel: [],
      rankingCandidateDescription: null,
      formulaLimit: 5,
    };
  });
