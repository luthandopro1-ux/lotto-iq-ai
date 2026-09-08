import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-guard";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(600).nullable().optional(),
  rule_type: z.string().min(1).max(60),
  weight: z.number().min(0).max(100).default(1),
  notes: z.string().max(600).nullable().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  category: z.string().max(40).optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  patch: z.object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(600).nullable().optional(),
    rule_type: z.string().min(1).max(60).optional(),
    weight: z.number().min(0).max(100).optional(),
    enabled: z.boolean().optional(),
    notes: z.string().max(600).nullable().optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    category: z.string().max(40).optional(),
  }),
});

/** Writes to public.strategies are backend-only; the browser goes through here. */
export const createStrategy = createServerFn({ method: "POST" })
  .middleware([adminGuard])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("strategies").insert({
      name: data.name,
      description: data.description ?? null,
      rule_type: data.rule_type,
      weight: data.weight,
      notes: data.notes ?? null,
      ...(data.params ? { params: data.params as never } : {}),
      ...(data.category ? { category: data.category } : {}),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateStrategy = createServerFn({ method: "POST" })
  .middleware([adminGuard])
  .inputValidator((data: unknown) => patchSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("strategies")
      .update(data.patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStrategy = createServerFn({ method: "POST" })
  .middleware([adminGuard])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("strategies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
