import { describe, expect, it } from "vitest";
import { buildLearning, dailySequence, emptyLearning, type Grading } from "./predict";
import { compareDrawSlots, isDrawBefore, type Draw } from "./uk49";

const draw = (date: string, session: Draw["session"], base: number): Draw => ({
  id: `${date}-${session}`,
  draw_date: date,
  session,
  n1: base,
  n2: base + 1,
  n3: base + 2,
  n4: base + 3,
  n5: base + 4,
  n6: base + 5,
  booster: null,
  source: "test",
  created_at: `${date}T00:00:00Z`,
});

const grading = (hit: number, miss: number): Grading => ({
  actual: [hit],
  booster: null,
  rows: [],
  poolHits: [hit],
  poolMisses: [miss],
  strategies: {
    strategy: { name: "test", hits: 1, misses: 1 },
  },
  matched: 1,
});

describe("temporal integrity", () => {
  it("orders sessions within the same date", () => {
    expect(
      compareDrawSlots(
        { draw_date: "2026-09-21", session: "brunch" },
        { draw_date: "2026-09-21", session: "lunch" },
      ),
    ).toBeLessThan(0);
    expect(
      isDrawBefore(
        { draw_date: "2026-09-21", session: "lunch" },
        { draw_date: "2026-09-21", session: "teatime" },
      ),
    ).toBe(true);
    expect(
      isDrawBefore(
        { draw_date: "2026-09-21", session: "teatime" },
        { draw_date: "2026-09-21", session: "brunch" },
      ),
    ).toBe(false);
  });

  it("builds a history sequence strictly before the target session", () => {
    const history = [
      draw("2026-09-21", "brunch", 1),
      draw("2026-09-21", "lunch", 7),
      draw("2026-09-21", "teatime", 13),
      draw("2026-09-20", "teatime", 19),
    ];

    const sequence = dailySequence(history, "2026-09-21", "drivetime");
    expect(sequence.map((d) => `${d.draw_date}#${d.session}`)).toEqual([
      "2026-09-21#lunch",
      "2026-09-21#brunch",
      "2026-09-20#teatime",
    ]);
    expect(sequence.some((d) => d.session === "teatime" && d.draw_date === "2026-09-21")).toBe(
      false,
    );
  });

  it("excludes same-session and later learning records", () => {
    const records = [
      { target_date: "2026-09-21", target_session: "brunch" as const, grading: grading(1, 2) },
      { target_date: "2026-09-21", target_session: "lunch" as const, grading: grading(3, 4) },
      { target_date: "2026-09-20", target_session: "teatime" as const, grading: grading(5, 6) },
    ];

    const learning = buildLearning(records, "2026-09-21", {
      targetDate: "2026-09-21",
      targetSession: "lunch",
    });

    expect(learning.sampleSize).toBe(2);
    expect(learning.recentHits).toContain(1);
    expect(learning.recentHits).toContain(5);
    expect(learning.recentHits).not.toContain(3);
  });

  it("does not mutate the empty learning baseline", () => {
    expect(
      buildLearning([], "2026-09-21", {
        targetDate: "2026-09-21",
        targetSession: "brunch",
      }),
    ).toEqual(emptyLearning());
  });
});
