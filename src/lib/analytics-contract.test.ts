import { describe, expect, it } from "vitest";
import {
  ANALYTICS_CONTRACT_VERSION,
  AnalysisRunRequestSchema,
  BacktestRequestSchema,
} from "@/lib/analytics-contract";
import { hashParameters } from "@/lib/observability.server";

describe("analytics contract", () => {
  it("accepts versioned analysis requests and rejects an unsupported contract", () => {
    const valid = AnalysisRunRequestSchema.safeParse({
      contractVersion: ANALYTICS_CONTRACT_VERSION,
      targetDate: "2026-09-21",
      targetSession: "brunch",
      strategyIds: [],
      sourceDrawWatermark: null,
      parametersHash: "a".repeat(64),
    });
    const invalid = AnalysisRunRequestSchema.safeParse({
      contractVersion: "analytics.v0",
      targetDate: "2026-09-21",
      targetSession: "brunch",
      strategyIds: [],
      sourceDrawWatermark: null,
      parametersHash: "a".repeat(64),
    });
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("validates bounded backtest parameters", () => {
    expect(
      BacktestRequestSchema.safeParse({
        contractVersion: ANALYTICS_CONTRACT_VERSION,
        dateFrom: "2026-01-01",
        dateTo: "2026-03-31",
        strategyIds: [],
        parametersHash: "b".repeat(64),
      }).success,
    ).toBe(true);
  });

  it("hashes equivalent parameter objects deterministically", async () => {
    const first = await hashParameters({
      dateTo: "2026-03-31",
      dateFrom: "2026-01-01",
      nested: { b: 2, a: 1 },
    });
    const second = await hashParameters({
      nested: { a: 1, b: 2 },
      dateFrom: "2026-01-01",
      dateTo: "2026-03-31",
    });
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(second);
  });
});
