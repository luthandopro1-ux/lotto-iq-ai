import { createManusTask } from "./manus-gateway.server";
import type { Db } from "@/lib/db.server";

type ModelSnapshot = Record<string, unknown>;

/** Pulls the most recent saved backtest for each game so the research prompt compares against real, current numbers — never invented ones. */
async function gatherOurModelSnapshot(db: Db): Promise<ModelSnapshot> {
  const snapshot: ModelSnapshot = {};

  const { data: uk49 } = await db
    .from("backtests")
    .select("date_from,date_to,results")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (uk49) {
    snapshot["uk49"] = {
      dateRange: `${uk49.date_from} to ${uk49.date_to}`,
      models: (uk49.results as { models?: unknown } | null)?.models ?? null,
    };
  }

  const { data: games } = await db.from("lottery_games").select("id,code,game_name");
  const russia: Record<string, unknown> = {};
  for (const game of games ?? []) {
    const { data: bt } = await db
      .from("lottery_backtests")
      .select("date_from,date_to,results")
      .eq("game_id", game.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (bt) {
      russia[game.code] = {
        dateRange: `${bt.date_from} to ${bt.date_to}`,
        metrics: (bt.results as { metrics?: unknown } | null)?.metrics ?? null,
      };
    }
  }
  if (Object.keys(russia).length > 0) snapshot["russia"] = russia;

  return snapshot;
}

function buildPrompt(snapshot: ModelSnapshot): string {
  const hasData = Object.keys(snapshot).length > 0;
  return `You are a research analyst helping evaluate a lottery-number statistical analysis tool (UK49 and Russian 5/50, 6/45, 7/49 formats — pattern/frequency analysis for entertainment purposes, not a guaranteed-win system).

TASK — two parts:

1. RESEARCH: search for current, publicly discussed lottery number analysis techniques and strategies (frequency analysis, gap/overdue analysis, hot/cold numbers, pair and triplet co-occurrence, Bayesian approaches, wheeling systems, any other statistical or software-based approaches people currently discuss). Summarise the most credible/commonly-cited ones and note their claimed rationale.

2. COMPARE: here is a snapshot of this tool's own actual backtested performance (walk-forward, no lookahead, real numbers from its own database — not estimates):

${hasData ? JSON.stringify(snapshot, null, 2) : "(no backtests have been run yet — skip the comparison and focus on part 1)"}

Compare the researched techniques against these actual figures. Note where this tool's approach aligns with, differs from, or could learn from what's publicly discussed. Be honest and specific — if the researched techniques and this tool's results both point to lottery draws being statistically close to random (as they mathematically are), say so plainly rather than overstating any edge.

OUTPUT FORMAT: end your final message with a JSON object (only JSON, no other text after it) with this exact shape:
{
  "summary": "2-3 sentence overview",
  "external_findings": ["finding 1", "finding 2", ...],
  "comparison": ["comparison point 1", "comparison point 2", ...],
  "sources": ["url1", "url2", ...]
}`;
}

export async function startWeeklyResearch(db: Db): Promise<{ id: string; taskId: string }> {
  const snapshot = await gatherOurModelSnapshot(db);
  const prompt = buildPrompt(snapshot);

  const task = await createManusTask(prompt);

  const { data, error } = await db
    .from("research_reports")
    .insert({
      manus_task_id: task.taskId,
      manus_task_url: task.taskUrl,
      status: "pending",
      prompt,
      our_model_snapshot: snapshot as never,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not save research task.");
  return { id: data.id as string, taskId: task.taskId };
}

/** Extracts the trailing JSON object from Manus's final message, same resilient-parse pattern used for the fast AI gateway. */
export function extractFindingsJson(message: string): unknown {
  try {
    return JSON.parse(message);
  } catch {
    const match = message.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function completeResearchReport(
  db: Db,
  manusTaskId: string,
  message: string,
  structuredOutput: unknown,
): Promise<void> {
  const findings = structuredOutput ?? extractFindingsJson(message);
  await db
    .from("research_reports")
    .update({
      status: "completed",
      findings: (findings ?? null) as never,
      raw_message: message,
      completed_at: new Date().toISOString(),
    })
    .eq("manus_task_id", manusTaskId);
}

export async function failResearchReport(
  db: Db,
  manusTaskId: string,
  error: string,
): Promise<void> {
  await db
    .from("research_reports")
    .update({ status: "failed", error, completed_at: new Date().toISOString() })
    .eq("manus_task_id", manusTaskId);
}

export async function listResearchReports(db: Db, limit = 10) {
  const { data } = await db
    .from("research_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
