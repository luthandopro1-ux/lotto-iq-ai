import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-guard";

const drawSchema = z.object({
  draw_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session: z.enum(["brunch", "lunch", "drivetime", "teatime"]),
  numbers: z.array(z.number().int().min(1).max(49)).length(6),
  booster: z.number().int().min(1).max(49).nullable().optional(),
  source: z.string().max(40).default("manual"),
});

const saveSchema = z.object({ draws: z.array(drawSchema).min(1).max(500) });

/** Writes to public.draws are backend-only; the browser goes through here. */
export const saveDraws = createServerFn({ method: "POST" })
  .middleware([adminGuard])
  .inputValidator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = data.draws.map((d) => ({
      draw_date: d.draw_date,
      session: d.session,
      n1: d.numbers[0]!,
      n2: d.numbers[1]!,
      n3: d.numbers[2]!,
      n4: d.numbers[3]!,
      n5: d.numbers[4]!,
      n6: d.numbers[5]!,
      booster: d.booster ?? null,
      source: d.source,
    }));
    const { error } = await supabaseAdmin
      .from("draws")
      .upsert(payload, { onConflict: "draw_date,session" });
    if (error) throw new Error(error.message);
    return { saved: payload.length };
  });

export const deleteDraw = createServerFn({ method: "POST" })
  .middleware([adminGuard])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("draws").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
