import { describe, expect, it } from "vitest";
import {
  asCandidates,
  asNumberArray,
  countVisibleMatches,
  flattenRowsToRanking,
  selectPredictionForTarget,
} from "./customer.functions";

// Matches predict.ts's real PickedNumber shape.
function pickedNumber(n: number, overrides: Partial<Record<string, unknown>> = {}) {
  return { n, score: 1, strategies: ["Test Strategy"], strategyIds: ["strategy-1"], ...overrides };
}

// Matches predict.ts's real PredictionRow shape.
function predictionRow(bankerN: number, partnerN: number, bonusN: number) {
  return {
    banker: pickedNumber(bankerN),
    pair: [pickedNumber(bankerN), pickedNumber(partnerN)],
    bonus: pickedNumber(bonusN),
  };
}

describe("asNumberArray (predictions.pool)", () => {
  it("unwraps PickedNumber objects — the actual bug", () => {
    const pool = [pickedNumber(4), pickedNumber(17), pickedNumber(23)];
    expect(asNumberArray(pool, 14)).toEqual([4, 17, 23]);
  });

  it("still accepts a flat number array defensively", () => {
    expect(asNumberArray([4, 17, 23], 14)).toEqual([4, 17, 23]);
  });

  it("respects the max limit", () => {
    const pool = Array.from({ length: 20 }, (_, i) => pickedNumber(i + 1));
    expect(asNumberArray(pool, 14)).toHaveLength(14);
  });

  it("drops out-of-range or malformed entries without throwing", () => {
    const pool = [pickedNumber(4), pickedNumber(0), pickedNumber(50), { n: "not-a-number" }, null];
    expect(asNumberArray(pool, 14)).toEqual([4]);
  });

  it("returns [] for non-array input", () => {
    expect(asNumberArray(null, 14)).toEqual([]);
    expect(asNumberArray(undefined, 14)).toEqual([]);
    expect(asNumberArray("not an array", 14)).toEqual([]);
  });
});

describe("countVisibleMatches", () => {
  it("counts only numbers in the displayed client pool", () => {
    const visiblePool = Array.from({ length: 14 }, (_, index) => index + 1);
    expect(countVisibleMatches(visiblePool, [2, 9, 22, 37])).toBe(2);
  });
});

describe("flattenRowsToRanking (predictions.rows)", () => {
  it("pulls banker, pair partner, and bonus out of each row in order", () => {
    const rows = [predictionRow(4, 17, 23)];
    expect(flattenRowsToRanking(rows, 7)).toEqual([4, 17, 23]);
  });

  it("de-duplicates across rows, keeping the first (highest-ranked) occurrence", () => {
    const rows = [predictionRow(4, 17, 23), predictionRow(17, 31, 4)];
    // 17 and 4 already appeared in row 1 — only 31 is new from row 2.
    expect(flattenRowsToRanking(rows, 7)).toEqual([4, 17, 23, 31]);
  });

  it("stops at max even mid-row", () => {
    const rows = [predictionRow(4, 17, 23), predictionRow(31, 38, 44)];
    expect(flattenRowsToRanking(rows, 4)).toEqual([4, 17, 23, 31]);
  });

  it("returns [] for non-array input", () => {
    expect(flattenRowsToRanking(null, 7)).toEqual([]);
    expect(flattenRowsToRanking(undefined, 7)).toEqual([]);
  });

  it("skips malformed rows without throwing", () => {
    const rows = [null, "not a row", predictionRow(4, 17, 23)];
    expect(flattenRowsToRanking(rows, 7)).toEqual([4, 17, 23]);
  });
});

describe("asCandidates (stored ensemble projection)", () => {
  it("returns only bounded, unique, score-safe candidate details", () => {
    expect(
      asCandidates([
        { number: 4, score: 4.25, agreement: 3, strategies: ["Private strategy"] },
        { number: 4, score: 3, agreement: 2 },
        { number: 17, score: Number.POSITIVE_INFINITY, agreement: 2 },
        { number: 23, score: 1.5, agreement: -1 },
        { number: 31, score: 2, agreement: 1 },
      ]),
    ).toEqual([
      { number: 4, score: 4.25, agreement: 3 },
      { number: 31, score: 2, agreement: 1 },
    ]);
  });
});

describe("selectPredictionForTarget", () => {
  const prediction = (date: string, session: string) => ({
    targetDate: date,
    targetSession: session,
  });

  it("selects only the prediction for the scheduled date and session", () => {
    const scheduled = prediction("2026-09-22", "lunch");
    const historical = prediction("2026-09-21", "teatime");
    expect(
      selectPredictionForTarget([historical, scheduled] as never, {
        date: "2026-09-22",
        session: "lunch",
      }),
    ).toBe(scheduled);
  });

  it("does not relabel a previous draw as today when the scheduled run is absent", () => {
    expect(
      selectPredictionForTarget([prediction("2026-09-21", "teatime")] as never, {
        date: "2026-09-22",
        session: "lunch",
      }),
    ).toBeNull();
  });
});
