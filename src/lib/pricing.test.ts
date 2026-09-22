import { describe, expect, it } from "vitest";
import { PREMIUM_PLAN, PREMIUM_PLANS, formatZar } from "./pricing";

describe("public Premium catalog", () => {
  it("exposes only the monthly R280 subscription", () => {
    expect(PREMIUM_PLANS).toHaveLength(1);
    expect(PREMIUM_PLAN).toMatchObject({
      code: "monthly",
      durationDays: 30,
      priceZarMinor: 28000,
    });
  });

  it("formats the authoritative ZAR price without a conversion", () => {
    expect(formatZar(PREMIUM_PLAN.priceZarMinor)).toMatch(/280/);
  });
});
