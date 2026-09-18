import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// The account tables are introduced by the paired Supabase migration. Keep the
// client query surface narrow until generated Supabase types include them.
type AccountRow = Record<string, unknown>;
type AccountDb = {
  from: (table: string) => {
    upsert: (values: AccountRow, options?: { onConflict?: string }) => Promise<{ error: Error | null }>;
    insert: (values: AccountRow) => Promise<{ error: Error | null }>;
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: AccountRow | null; error: Error | null }>;
      };
    };
  };
};

export const ensurePersonalAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ displayName: z.string().trim().max(80).optional() }).parse(input ?? {}))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as AccountDb;
    const userId = context.userId;

    const profileResult = await db.from("profiles").upsert(
      { id: userId, ...(data.displayName ? { display_name: data.displayName } : {}) },
      { onConflict: "id" },
    );
    if (profileResult.error) throw new Error(profileResult.error.message);

    const existing = await db
      .from("workspaces")
      .select("id,name,owner_id,created_at,updated_at")
      .eq("owner_id", userId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);

    let workspace = existing.data;
    if (!workspace) {
      const created = await db.from("workspaces").insert({
        name: "My Lotto IQ workspace",
        owner_id: userId,
      });
      if (created.error) throw new Error(created.error.message);

      const reloaded = await db
        .from("workspaces")
        .select("id,name,owner_id,created_at,updated_at")
        .eq("owner_id", userId)
        .maybeSingle();
      if (reloaded.error || !reloaded.data) {
        throw new Error(reloaded.error?.message ?? "Workspace was not created");
      }
      workspace = reloaded.data;
    }

    const membership = await db.from("workspace_members").upsert(
      { workspace_id: String(workspace["id"]), user_id: userId, role: "owner" },
      { onConflict: "workspace_id,user_id" },
    );
    if (membership.error) throw new Error(membership.error.message);

    const settings = await db.from("workspace_settings").upsert(
      { workspace_id: String(workspace["id"]), game_code: "UK49", timezone: "Africa/Johannesburg" },
      { onConflict: "workspace_id" },
    );
    if (settings.error) throw new Error(settings.error.message);

    return {
      userId,
      workspace: {
        id: String(workspace["id"]),
        name: String(workspace["name"] ?? "My Lotto IQ workspace"),
      },
    };
  });
