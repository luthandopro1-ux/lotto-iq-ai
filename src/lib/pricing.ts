export type PremiumPlanCode = "weekly" | "monthly" | "yearly";

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
    code: "weekly",
    label: "7-day Premium",
    intervalLabel: "Every 7 days",
    durationDays: 7,
    priceZarMinor: 7000,
    discountPercent: 0,
    autoRenew: true,
  },
  {
    code: "monthly",
    label: "Monthly Premium",
    intervalLabel: "Every 30 days",
    durationDays: 30,
    priceZarMinor: 28000,
    discountPercent: 0,
    autoRenew: true,
  },
  {
    code: "yearly",
    label: "Yearly Premium",
    intervalLabel: "Every 12 months",
    durationDays: 365,
    priceZarMinor: 302400,
    discountPercent: 10,
    autoRenew: true,
  },
];

export const BASE_PRICING_CURRENCY = "ZAR" as const;

export function formatZar(minor: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: BASE_PRICING_CURRENCY,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}
