import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  session: z.enum(["brunch", "lunch", "drivetime", "teatime"]).optional(),
  slots: z.number().int().min(20).max(200).optional(),
});

/**
 * Read-only adaptive intelligence: walk-forward strategy scoring on top of the
 * existing formula. It never changes what the core engine saved.
 */
export const adaptiveReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { serverDb } = await import("@/lib/db.server");
    const { structuralSequence } = await import("@/lib/structure");
    const { adaptiveLayer } = await import("@/lib/adaptive");
    const { ukDate } = await import("@/lib/sessions");

    const db = serverDb();
    const [{ data: drawRows }, { data: strategyRows }] = await Promise.all([
      db.from("draws").select("*").order("draw_date", { ascending: false }).limit(600),
      db.from("strategies").select("*").eq("enabled", true),
    ]);

    const history = (drawRows ?? []) as never[] as import("@/lib/uk49").Draw[];
    const strategies = (strategyRows ?? []) as never[] as import("@/lib/uk49").Strategy[];
    if (history.length === 0 || strategies.length === 0) return null;

    const sequence = structuralSequence(history);
    return adaptiveLayer(
      strategies,
      sequence,
      { date: data.date ?? ukDate(new Date()), session: data.session ?? "brunch" },
      data.slots ?? 60,
    );
  });
