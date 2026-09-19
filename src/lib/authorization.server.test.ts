import { describe, expect, it } from "vitest";
import { resolveAccessContext } from "./authorization.server";
import { hasCapability, type AccessContext } from "./access-types";

type Row = Record<string, unknown> | null;

function fakeSupabase(opts: {
  isAdministrator?: boolean;
  workspace?: Row;
  entitlement?: Row;
  rpcError?: string;
  workspaceError?: string;
  entitlementError?: string;
  accessStatus?: string;
  accessStatusError?: string;
}) {
  return {
    rpc: async (fn: string) => {
      if (fn === "get_my_access_status") {
        if (opts.accessStatusError) return { data: null, error: new Error(opts.accessStatusError) };
        return { data: opts.accessStatus ?? "active", error: null };
      }
      if (fn !== "is_administrator") throw new Error(`unexpected rpc: ${fn}`);
      if (opts.rpcError) return { data: null, error: new Error(opts.rpcError) };
      return { data: opts.isAdministrator ?? false, error: null };
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (table === "workspaces") {
              if (opts.workspaceError) {
                return { data: null, error: new Error(opts.workspaceError) };
              }
              return { data: opts.workspace ?? null, error: null };
            }
            if (table === "workspace_entitlements") {
              if (opts.entitlementError) {
                return { data: null, error: new Error(opts.entitlementError) };
              }
              return { data: opts.entitlement ?? null, error: null };
            }
            throw new Error(`unexpected table: ${table}`);
          },
        }),
      }),
    }),
  };
}

describe("resolveAccessContext", () => {
  it("resolves administrator role without checking workspace/entitlement", async () => {
    const supabase = fakeSupabase({ isAdministrator: true });
    const ctx = await resolveAccessContext(supabase, "user-admin");
    expect(ctx).toEqual({
      userId: "user-admin",
      role: "administrator",
      workspaceId: null,
      planCode: null,
      planStatus: null,
    });
  });

  it("resolves free role when no workspace has been bootstrapped yet", async () => {
    const supabase = fakeSupabase({ isAdministrator: false, workspace: null });
    const ctx = await resolveAccessContext(supabase, "user-new");
    expect(ctx.role).toBe("free");
    expect(ctx.workspaceId).toBeNull();
  });

  it("resolves free role when entitlement plan_code is free", async () => {
    const supabase = fakeSupabase({
      isAdministrator: false,
      workspace: { id: "ws-1" },
      entitlement: { plan_code: "free", status: "active" },
    });
    const ctx = await resolveAccessContext(supabase, "user-free");
    expect(ctx.role).toBe("free");
    expect(ctx.workspaceId).toBe("ws-1");
  });

  it("resolves premium role when entitlement is active premium", async () => {
    const supabase = fakeSupabase({
      isAdministrator: false,
      workspace: { id: "ws-2" },
      entitlement: { plan_code: "premium", status: "active" },
    });
    const ctx = await resolveAccessContext(supabase, "user-premium");
    expect(ctx.role).toBe("premium");
  });

  it("resolves premium role when entitlement is trialing", async () => {
    const supabase = fakeSupabase({
      isAdministrator: false,
      workspace: { id: "ws-3" },
      entitlement: { plan_code: "premium", status: "trialing" },
    });
    const ctx = await resolveAccessContext(supabase, "user-trial");
    expect(ctx.role).toBe("premium");
  });

  it("does NOT resolve premium when plan_code is premium but status is canceled", async () => {
    const supabase = fakeSupabase({
      isAdministrator: false,
      workspace: { id: "ws-4" },
      entitlement: { plan_code: "premium", status: "canceled" },
    });
    const ctx = await resolveAccessContext(supabase, "user-lapsed");
    expect(ctx.role).toBe("free");
  });

  it("throws (fail-closed) when the administrator RPC errors", async () => {
    const supabase = fakeSupabase({ rpcError: "network down" });
    await expect(resolveAccessContext(supabase, "user-x")).rejects.toThrow(/administrator status/);
  });

  it("rejects suspended accounts before loading workspace data", async () => {
    const supabase = fakeSupabase({ isAdministrator: false, accessStatus: "suspended" });
    await expect(resolveAccessContext(supabase, "user-suspended")).rejects.toThrow(/not permitted/);
  });

  it("throws (fail-closed) when account status cannot be resolved", async () => {
    const supabase = fakeSupabase({ isAdministrator: false, accessStatusError: "db down" });
    await expect(resolveAccessContext(supabase, "user-x")).rejects.toThrow(/account access status/);
  });

  it("throws (fail-closed) when the workspace lookup errors", async () => {
    const supabase = fakeSupabase({ isAdministrator: false, workspaceError: "db down" });
    await expect(resolveAccessContext(supabase, "user-x")).rejects.toThrow(/resolve workspace/);
  });

  it("throws (fail-closed) when the entitlement lookup errors", async () => {
    const supabase = fakeSupabase({
      isAdministrator: false,
      workspace: { id: "ws-5" },
      entitlementError: "db down",
    });
    await expect(resolveAccessContext(supabase, "user-x")).rejects.toThrow(/resolve entitlement/);
  });
});

describe("hasCapability", () => {
  const base = { userId: "u", workspaceId: null, planCode: null, planStatus: null };

  it("unauthenticated has no capabilities", () => {
    const ctx: AccessContext = { ...base, role: "unauthenticated" };
    expect(hasCapability(ctx, "core_analysis")).toBe(false);
    expect(hasCapability(ctx, "backtest")).toBe(false);
  });

  it("free has core_analysis and notifications only", () => {
    const ctx: AccessContext = { ...base, role: "free" };
    expect(hasCapability(ctx, "core_analysis")).toBe(true);
    expect(hasCapability(ctx, "notifications")).toBe(true);
    expect(hasCapability(ctx, "backtest")).toBe(false);
    expect(hasCapability(ctx, "advanced_ai")).toBe(false);
  });

  it("premium has every capability", () => {
    const ctx: AccessContext = { ...base, role: "premium" };
    expect(hasCapability(ctx, "backtest")).toBe(true);
    expect(hasCapability(ctx, "advanced_ai")).toBe(true);
    expect(hasCapability(ctx, "exports")).toBe(true);
  });

  it("administrator has every capability implicitly", () => {
    const ctx: AccessContext = { ...base, role: "administrator" };
    expect(hasCapability(ctx, "backtest")).toBe(true);
    expect(hasCapability(ctx, "exports")).toBe(true);
  });
});
