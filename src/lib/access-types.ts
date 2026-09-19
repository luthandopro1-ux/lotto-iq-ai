/**
 * Centralized access-role and capability types for Lotto IQ.
 *
 * Part of the architecture migration plan's Phase 2 ("Central
 * authentication and role resolution"). These types are the shared
 * vocabulary that future entitlement enforcement (Phase 4) and route
 * separation (Phase 6) will build on. Introducing them here does not
 * change any existing route, server function, or database contract —
 * nothing currently imports or enforces these yet.
 */

/** Resolved access level for the current request. */
export type AccessRole = "unauthenticated" | "free" | "premium" | "administrator";

/**
 * Capabilities gated behind Premium, per the migration plan's proposed
 * entitlement module. Kept here (not yet enforced) so the vocabulary is
 * fixed before Phase 4 wires enforcement into protected server functions.
 */
export type Capability =
  | "core_analysis"
  | "saved_strategies"
  | "advanced_analysis"
  | "ensemble_wheel"
  | "backtest"
  | "advanced_ai"
  | "exports"
  | "notifications";

export const ALL_CAPABILITIES: readonly Capability[] = [
  "core_analysis",
  "saved_strategies",
  "advanced_analysis",
  "ensemble_wheel",
  "backtest",
  "advanced_ai",
  "exports",
  "notifications",
];

/**
 * Default capability sets per role. Administrators implicitly get every
 * capability (see `hasCapability`) rather than needing this list kept in
 * sync by hand.
 */
export const ROLE_CAPABILITIES: Readonly<
  Record<Exclude<AccessRole, "administrator">, ReadonlySet<Capability>>
> = {
  unauthenticated: new Set([]),
  free: new Set(["core_analysis", "notifications"]),
  premium: new Set(ALL_CAPABILITIES),
};

/** Resolved authorization context for one authenticated request. */
export interface AccessContext {
  userId: string;
  role: AccessRole;
  /** The user's personal workspace id, if one has been bootstrapped yet. */
  workspaceId: string | null;
  planCode: "free" | "premium" | null;
  planStatus: string | null;
}

export function hasCapability(context: AccessContext, capability: Capability): boolean {
  if (context.role === "administrator") return true;
  if (context.role === "unauthenticated") return false;
  return ROLE_CAPABILITIES[context.role].has(capability);
}
