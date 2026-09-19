import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AccessContext, AccessRole } from "@/lib/access-types";

// Narrow surface over the Supabase client used here, matching the pattern
// already used in account.functions.ts: keep the query surface explicit
// until generated Supabase types include the newer tables/functions.
type MaybeSingleResult = Promise<{ data: Record<string, unknown> | null; error: Error | null }>;
type AuthorizationDb = {
  rpc: (fn: "is_administrator") => Promise<{ data: boolean | null; error: Error | null }>;
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => { maybeSingle: () => MaybeSingleResult };
    };
  };
};

/**
 * Resolves the caller's AccessContext from an already-authenticated
 * Supabase client (i.e. one produced by requireSupabaseAuth, bound to the
 * caller's own JWT). Every query here runs under the caller's own RLS
 * policies — this function grants no additional privilege on its own.
 *
 * Role precedence: administrator > premium > free. A user with no
 * bootstrapped workspace yet (ensurePersonalAccount not called) resolves
 * to "free" rather than erroring, since that's a legitimate transient
 * state for a newly-registered account.
 */
export async function resolveAccessContext(
  supabase: unknown,
  userId: string,
): Promise<AccessContext> {
  const db = supabase as AuthorizationDb;

  const adminCheck = await db.rpc("is_administrator");
  if (adminCheck.error) {
    throw new Error(`Failed to resolve administrator status: ${adminCheck.error.message}`);
  }
  if (adminCheck.data === true) {
    return { userId, role: "administrator", workspaceId: null, planCode: null, planStatus: null };
  }

  const workspace = await db.from("workspaces").select("id").eq("owner_id", userId).maybeSingle();
  if (workspace.error) {
    throw new Error(`Failed to resolve workspace: ${workspace.error.message}`);
  }

  const workspaceId = workspace.data ? String(workspace.data["id"]) : null;
  if (!workspaceId) {
    return { userId, role: "free", workspaceId: null, planCode: null, planStatus: null };
  }

  const entitlement = await db
    .from("workspace_entitlements")
    .select("plan_code,status")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (entitlement.error) {
    throw new Error(`Failed to resolve entitlement: ${entitlement.error.message}`);
  }

  const planCode = (entitlement.data?.["plan_code"] as "free" | "premium" | undefined) ?? "free";
  const planStatus = (entitlement.data?.["status"] as string | undefined) ?? null;
  const isActivePremium =
    planCode === "premium" && (planStatus === "active" || planStatus === "trialing");
  const role: AccessRole = isActivePremium ? "premium" : "free";

  return { userId, role, workspaceId, planCode, planStatus };
}

/**
 * Server-function middleware that resolves and attaches `accessContext`.
 * Not yet applied to any existing server function — this is the Phase 2
 * building block. Wiring it into protected routes/functions and adding
 * requireCapability() enforcement is Phase 4, a separate, reviewable step.
 *
 * Usage once adopted:
 *   createServerFn(...).middleware([requireAccessContext]).handler(({ context }) => {
 *     context.accessContext.role // "unauthenticated" | "free" | "premium" | "administrator"
 *   })
 */
export const requireAccessContext = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const accessContext = await resolveAccessContext(context.supabase, context.userId);
    return next({ context: { accessContext } });
  });
