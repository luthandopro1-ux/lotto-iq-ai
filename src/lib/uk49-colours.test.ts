import { describe, expect, it } from "vitest";
import { UK49_COLOUR_NUMBERS, uk49ColourForNumber } from "@/lib/uk49-colours";

describe("UK49 colour balls", () => {
  it("assigns each number to its stable seven-colour group", () => {
    expect(uk49ColourForNumber(1)).toBe("green");
    expect(uk49ColourForNumber(2)).toBe("red");
    expect(uk49ColourForNumber(7)).toBe("blue");
    expect(uk49ColourForNumber(8)).toBe("green");
    expect(uk49ColourForNumber(49)).toBe("blue");
  });

  it("covers every UK49 number exactly once", () => {
    const numbers = Object.values(UK49_COLOUR_NUMBERS)
      .flat()
      .sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 49 }, (_, index) => index + 1));
  });
});
