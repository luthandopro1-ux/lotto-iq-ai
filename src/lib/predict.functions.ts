import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SESSIONS } from "@/lib/uk49";
import { adminGuard } from "@/lib/admin-guard";

const BoardInput = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  sync: z.boolean().optional(),
});

/**
 * The daily engine.
 * 1. syncs the latest UK49s results
 * 2. grades every pending prediction against the draw that has landed
 * 3. learns from those hits and misses
 * 4. re-runs all active strategies and saves a prediction for every
 *    remaining session of the day (Brunch -> Lunch -> Drive Time -> Tea Time)
 */
export const runDailyBoard = createServerFn({ method: "POST" })
  .middleware([adminGuard])
  .inputValidator((input: unknown) => BoardInput.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { runDailyBoard: run } = await import("@/lib/daily.server");
    return run({
      ...(data.date ? { date: data.date } : {}),
      ...(data.sync === false ? { sync: false } : {}),
    });
  });
