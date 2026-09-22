/**
 * The public Premium catalog intentionally has one plan. Historical entitlement
 * records may still carry legacy intervals, but no legacy plan is presented or
 * selectable in the client application.
 */
export type PremiumPlanCode = "monthly";

export type PremiumPlan = {
  code: PremiumPlanCode;
  label: string;
  intervalLabel: string;
  durationDays: number;
  priceZarMinor: number;
  discountPercent: number;
  autoRenew: true;
};

export const PREMIUM_PLANS: readonly PremiumPlan[] = [
  {
    code: "monthly",
    label: "Monthly Premium",
    intervalLabel: "Every 30 days",
    durationDays: 30,
    priceZarMinor: 28000,
    discountPercent: 0,
    autoRenew: true,
  },
];

/** The only public Premium subscription plan. */
export const PREMIUM_PLAN = PREMIUM_PLANS[0]!;

export const BASE_PRICING_CURRENCY = "ZAR" as const;

export function formatZar(minor: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: BASE_PRICING_CURRENCY,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}
