import { describe, expect, it } from "vitest";
import { nextTarget, ukDate } from "@/lib/sessions";

describe("UK49 next review schedule", () => {
  it("uses the current UK date before the first draw", () => {
    const result = nextTarget(new Date("2026-09-22T05:30:00.000Z"));
    expect(result).toEqual({ date: "2026-09-22", session: "brunch" });
  });

  it("advances to the next UK date after all draws have passed", () => {
    const result = nextTarget(new Date("2026-09-22T21:00:00.000Z"));
    expect(result).toEqual({ date: "2026-09-23", session: "brunch" });
  });

  it("does not use the server's local timezone for the calendar date", () => {
    expect(ukDate(new Date("2026-09-22T00:30:00.000Z"))).toBe("2026-09-22");
  });
});
