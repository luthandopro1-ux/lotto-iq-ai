import { describe, expect, it } from "vitest";
import { adaptiveLayer } from "./adaptive";
import { runAnalysis } from "./engine";
import {
  ALL_NUMBERS,
  FAMILY_GROUPS,
  SECTION_GROUPS,
  WHEEL_GROUPS,
  digitalRoot,
  structuralSequence,
} from "./structure";
import { SESSIONS, type Draw, type Strategy } from "./uk49";

const strategy = (id: string, multiplier: number, weight: number): Strategy => ({
  id,
  name: id,
  description: null,
  rule_type: "date_x_constant",
  params: { multiplier },
  weight,
  enabled: true,
  notes: null,
});

const sortedNumbers = (groups: Record<string, number[]>) =>
  Object.values(groups)
    .flat()
    .sort((a, b) => a - b);

describe("structural groupings", () => {
  it("wheels partition 1-49 exactly once and step by 8", () => {
    expect(sortedNumbers(WHEEL_GROUPS)).toEqual(ALL_NUMBERS);
    for (const numbers of Object.values(WHEEL_GROUPS)) {
      numbers.slice(1).forEach((n, i) => expect(n - numbers[i]!).toBe(8));
    }
  });

  it("families partition 1-49 by last digit", () => {
    expect(sortedNumbers(FAMILY_GROUPS)).toEqual(ALL_NUMBERS);
    for (const [key, numbers] of Object.entries(FAMILY_GROUPS)) {
      const digit = Number(key.slice(1));
      expect(numbers.every((n) => n % 10 === digit)).toBe(true);
    }
  });

  it("sections partition 1-49 exactly once", () => {
    expect(sortedNumbers(SECTION_GROUPS)).toEqual(ALL_NUMBERS);
  });

  it("digital root stays within 1-9 and matches modular arithmetic", () => {
    for (const n of ALL_NUMBERS) {
      expect(digitalRoot(n)).toBeGreaterThanOrEqual(1);
      expect(digitalRoot(n)).toBeLessThanOrEqual(9);
      expect(digitalRoot(n) % 9).toBe(n % 9);
    }
  });
});

describe("formula engine", () => {
  const run = (strategies: Strategy[]) =>
    runAnalysis(strategies, {
      date: new Date("2026-10-15T12:00:00Z"),
      session: "brunch",
      history: [],
      previousThree: [],
    });

  it("reads the day of month in UTC so results do not depend on the runtime timezone", () => {
    const result = run([strategy("a", 3, 1)]);
    const traces = result.ranked.flatMap((r) => r.hits.flatMap((h) => h.traces));
    expect(traces.length).toBeGreaterThan(0);
    expect(traces.some((t) => JSON.stringify(t).includes("15"))).toBe(true);
    expect(traces.some((t) => JSON.stringify(t).includes("16"))).toBe(false);
  });

  it("keeps a zero weight at zero instead of promoting it to one", () => {
    const result = run([strategy("zero", 3, 0), strategy("one", 5, 1)]);
    const zeroHits = result.ranked.flatMap((r) => r.hits).filter((h) => h.strategyId === "zero");
    expect(zeroHits.length).toBeGreaterThan(0);
    expect(zeroHits.every((h) => h.weight === 0)).toBe(true);
  });
});

describe("adaptive layer", () => {
  const history: Draw[] = [];
  for (let day = 0; day < 14; day += 1) {
    const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
    SESSIONS.forEach((session, s) => {
      const base = ((day * 4 + s) * 7) % 43;
      history.push({
        id: `${date}-${session}`,
        draw_date: date,
        session,
        n1: base + 1,
        n2: base + 2,
        n3: base + 3,
        n4: base + 4,
        n5: base + 5,
        n6: base + 6,
        booster: null,
        source: "test",
        created_at: `${date}T00:00:00Z`,
      });
    });
  }
  const strategies = [strategy("s3", 3, 1), strategy("s7", 7, 1.5)];

  it("never uses draws at or after the target slot", () => {
    const targetIndex = 40;
    const target = {
      date: history[targetIndex]!.draw_date,
      session: history[targetIndex]!.session,
    };
    const withFuture = adaptiveLayer(strategies, structuralSequence(history), target);
    const withoutFuture = adaptiveLayer(
      strategies,
      structuralSequence(history.slice(0, targetIndex)),
      target,
    );
    expect(JSON.stringify(withFuture)).toBe(JSON.stringify(withoutFuture));
  });
});
