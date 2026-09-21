/**
 * Canonical UK49s colour groups.
 *
 * The seven colours repeat by column across 1–49. This keeps the same number
 * visually stable everywhere: 1/8/15/... are green, 2/9/16/... are red, etc.
 */
export const UK49_COLOUR_ORDER = [
  "green",
  "red",
  "orange",
  "yellow",
  "brown",
  "purple",
  "blue",
] as const;

export type UK49Colour = (typeof UK49_COLOUR_ORDER)[number];

export const UK49_COLOUR_LABELS: Record<UK49Colour, string> = {
  green: "Green",
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  brown: "Brown",
  purple: "Purple",
  blue: "Blue",
};

export function uk49ColourForNumber(number: number): UK49Colour {
  const normalized = Math.trunc(number);
  if (normalized < 1 || normalized > 49) return "green";
  return UK49_COLOUR_ORDER[(normalized - 1) % UK49_COLOUR_ORDER.length]!;
}

export const UK49_COLOUR_NUMBERS: Record<UK49Colour, number[]> = Object.fromEntries(
  UK49_COLOUR_ORDER.map((colour, index) => [
    colour,
    Array.from({ length: 7 }, (_, row) => index + 1 + row * 7),
  ]),
) as Record<UK49Colour, number[]>;
