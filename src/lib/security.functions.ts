import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAccessContext } from "@/lib/authorization.server";

const accessInput = z.object({
  userId: z.string().uuid(),
  status: z.enum(["active", "suspended", "revoked"]),
  reason: z.string().trim().max(240).optional(),
});

export type SecurityOverview = {
  accounts: { registered: number; created_last_24h: number; confirmed: number; controlled: number };
  controls: Array<{
    user_id: string;
    status: "active" | "suspended" | "revoked";
    reason: string | null;
    changed_by: string | null;
    changed_at: string;
  }>;
  audit: Array<{
    id: string;
    actor_user_id: string;
    action: string;
    target_user_id: string | null;
    metadata: Record<string, string | number | boolean | null>;
    created_at: string;
  }>;
};

type SecurityDb = {
  rpc: (
    name: "get_admin_security_overview" | "admin_set_account_access",
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export const getSecurityOverview = createServerFn({ method: "GET" })
  .middleware([requireAccessContext])
  .handler(async ({ context }): Promise<SecurityOverview> => {
    if (context.accessContext.role !== "administrator")
      throw new Error("Administrator access required.");
    const { data, error } = await (context.supabase as unknown as SecurityDb).rpc(
      "get_admin_security_overview",
    );
    if (error) throw new Error(`Failed to load security overview: ${error.message}`);
    return data as SecurityOverview;
  });

export const setAccountAccess = createServerFn({ method: "POST" })
  .middleware([requireAccessContext])
  .inputValidator((input: unknown) => accessInput.parse(input))
  .handler(
    async ({
      context,
      data,
    }): Promise<{ user_id: string; status: "active" | "suspended" | "revoked" }> => {
      if (context.accessContext.role !== "administrator")
        throw new Error("Administrator access required.");
      const input = data;
      const { data: result, error } = await (context.supabase as unknown as SecurityDb).rpc(
        "admin_set_account_access",
        {
          p_user_id: input.userId,
          p_status: input.status,
          p_reason: input.reason?.trim() || null,
        },
      );
      if (error) throw new Error(`Failed to update account access: ${error.message}`);
      const output = result as { user_id?: unknown; status?: unknown };
      if (
        typeof output.user_id !== "string" ||
        !["active", "suspended", "revoked"].includes(String(output.status))
      ) {
        throw new Error("Security action returned an invalid result.");
      }
      return {
        user_id: output.user_id,
        status: output.status as "active" | "suspended" | "revoked",
      };
    },
  );
