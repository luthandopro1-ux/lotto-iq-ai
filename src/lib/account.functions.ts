import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// The account tables are introduced by the paired Supabase migration. Keep the
// client query surface narrow until generated Supabase types include them.
type AccountDb = {
  rpc: (
    fn: "bootstrap_personal_account",
    args: { p_display_name?: string | null },
  ) => Promise<{
    data: { user_id: string; workspace_id: string; workspace_name: string }[] | null;
    error: Error | null;
  }>;
};

export const ensurePersonalAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ displayName: z.string().trim().max(80).optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as AccountDb;
    const result = await db.rpc("bootstrap_personal_account", {
      p_display_name: data.displayName?.trim() || null,
    });

    if (result.error) throw new Error(result.error.message);
    const workspace = result.data?.[0];
    if (!workspace) throw new Error("Workspace was not created");

    return {
      userId: workspace.user_id,
      workspace: {
        id: workspace.workspace_id,
        name: workspace.workspace_name,
      },
    };
  });
