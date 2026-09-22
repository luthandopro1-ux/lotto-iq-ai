import { describe, expect, it } from "vitest";
import { asNumberArray, countVisibleMatches, flattenRowsToRanking } from "./customer.functions";

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
