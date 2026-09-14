import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-guard";

const ImportInput = z.object({ raw: z.string().min(3).max(200000) });

const SESSION_SET = ["brunch", "lunch", "drivetime", "teatime"] as const;

const ParsedDraw = z.object({
  draw_date: z.string(),
  session: z.enum(SESSION_SET),
  numbers: z.array(z.number()).length(6),
  booster: z.number().nullable().optional(),
});

export type ParsedDraw = z.infer<typeof ParsedDraw>;

const SYSTEM = `You are a data-extraction engine for UK49 lottery results.
The user pastes results in ANY format: CSV, tab-separated, copied website tables,
WhatsApp messages, PDF text dumps, mixed orders, messy spacing, multiple draws per line.

Extract EVERY draw you can find and return strict JSON:
{"draws":[{"draw_date":"YYYY-MM-DD","session":"brunch|lunch|drivetime|teatime","numbers":[6 integers 1-49],"booster":integer 1-49 or null}],"notes":"one short sentence about what you found or skipped"}

Rules:
- session mapping: brunch/morning/early -> brunch; lunch/lunchtime/midday/49s lunchtime -> lunch;
  drive/drivetime/afternoon/evening drive -> drivetime; tea/teatime/night/evening -> teatime.
- If the session is not stated, infer from any time shown (before 11:00 brunch, before 14:00 lunch,
  before 19:00 drivetime, otherwise teatime). If nothing indicates a session, use "lunch".
- Dates may be DD/MM/YYYY, D MMM YY, YYYY-MM-DD etc. UK format: day comes first when ambiguous.
- The booster is usually the last or bracketed/highlighted number. If absent use null.
- Exactly 6 main numbers per draw, each 1-49. Skip any draw you cannot resolve to 6 valid numbers.
- Never invent draws. Return only what appears in the input.`;

export const smartImportDraws = createServerFn({ method: "POST" })
  .middleware([adminGuard])
  .inputValidator((input: unknown) => ImportInput.parse(input))
  .handler(async ({ data }) => {
    const { gatewayJson } = await import("./ai-gateway.server");
    const result = (await gatewayJson(SYSTEM, data.raw)) as {
      draws?: unknown[];
      notes?: string;
    };

    const draws: ParsedDraw[] = [];
    const seen = new Set<string>();
    for (const item of result.draws ?? []) {
      const parsed = ParsedDraw.safeParse(item);
      if (!parsed.success) continue;
      const d = parsed.data;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.draw_date)) continue;
      if (d.numbers.some((n) => !Number.isInteger(n) || n < 1 || n > 49)) continue;
      if (new Set(d.numbers).size !== 6) continue;
      const key = `${d.draw_date}|${d.session}`;
      if (seen.has(key)) continue;
      seen.add(key);
      draws.push({
        ...d,
        booster: d.booster && d.booster >= 1 && d.booster <= 49 ? d.booster : null,
      });
    }

    return {
      draws,
      notes: typeof result.notes === "string" ? result.notes : "",
    };
  });

const InsightInput = z.object({ summary: z.string().min(3).max(60000) });

export const aiInsights = createServerFn({ method: "POST" })
  .middleware([adminGuard])
  .inputValidator((input: unknown) => InsightInput.parse(input))
  .handler(async ({ data }) => {
    const { gatewayJson } = await import("./ai-gateway.server");
    const result = (await gatewayJson(
      `You are a lottery strategy analyst for the Lotto IQ AI platform.
You receive a statistical summary of historical UK49 draws and user-defined strategy outputs.
Return strict JSON: {"headline":"...","insights":[{"title":"...","detail":"..."}],"caveat":"..."}
Give at most 5 insights. Cover strategy overlap, recurring calculations, historical trends and
strategy performance where the data supports it. Keep each detail under 3 sentences.
The caveat must state plainly that this is historical analysis of user-defined strategies,
not a prediction, and that lottery draws are random.`,
      data.summary,
    )) as {
      headline?: string;
      insights?: { title?: string; detail?: string }[];
      caveat?: string;
    };

    return {
      headline: result.headline ?? "Analysis complete",
      insights: (result.insights ?? [])
        .slice(0, 5)
        .map((i) => ({ title: i.title ?? "Insight", detail: i.detail ?? "" })),
      caveat:
        result.caveat ??
        "This is historical analysis of your own strategies, not a prediction. UK49 draws are random.",
    };
  });
