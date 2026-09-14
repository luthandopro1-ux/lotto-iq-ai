/**
 * STRUCTURAL LAYER — Dream Wheel / Family / Section.
 *
 * Pure, additive structural classification of the numbers 1-49.
 * Nothing here replaces or modifies the existing formula engine
 * (src/lib/engine.ts, src/lib/predict.ts) or the statistical layer
 * (src/lib/stats.ts). It only describes structure so other layers can
 * test it against history.
 */
import { SESSIONS, drawNumbers, type Draw, type SessionKey } from "./uk49";

export const ALL_NUMBERS = Array.from({ length: 49 }, (_, i) => i + 1);

/* ------------------------------------------------------------------ */
/* Dream Wheel — the +8 structural relationship                        */
/* ------------------------------------------------------------------ */

export const WHEEL_GROUPS: Record<string, number[]> = {
  W1: [1, 9, 17, 25, 33, 41, 49],
  W2: [2, 10, 18, 26, 34, 42],
  W3: [3, 11, 19, 27, 35, 43],
  W4: [4, 12, 20, 28, 36, 44],
  W5: [5, 13, 21, 29, 37, 45],
  W6: [6, 14, 22, 30, 38, 46],
  W7: [7, 15, 23, 31, 39, 47],
  W8: [8, 16, 24, 32, 40, 48],
};
export const WHEEL_KEYS = Object.keys(WHEEL_GROUPS);

/* ------------------------------------------------------------------ */
/* Families — final digit                                              */
/* ------------------------------------------------------------------ */

export const FAMILY_KEYS = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F0"];
export const FAMILY_GROUPS: Record<string, number[]> = Object.fromEntries(
  FAMILY_KEYS.map((k) => [k, [] as number[]]),
);
for (const n of ALL_NUMBERS) FAMILY_GROUPS[`F${n % 10}`]!.push(n);

/* ------------------------------------------------------------------ */
/* Sections — digital root                                             */
/* ------------------------------------------------------------------ */

export const digitalRoot = (n: number): number => (n <= 0 ? 0 : 1 + ((n - 1) % 9));

export const SECTION_KEYS = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"];
export const SECTION_GROUPS: Record<string, number[]> = Object.fromEntries(
  SECTION_KEYS.map((k) => [k, [] as number[]]),
);
for (const n of ALL_NUMBERS) SECTION_GROUPS[`S${digitalRoot(n)}`]!.push(n);

/* ------------------------------------------------------------------ */
/* Structural profile of every number                                  */
/* ------------------------------------------------------------------ */

export type StructureKind = "wheel" | "family" | "section";

export interface StructuralProfile {
  number: number;
  wheelGroup: string;
  family: string;
  section: string;
  wheelPosition: number;
  familyPosition: number;
  sectionPosition: number;
  /** Other members of the wheel group — the +8 relatives. */
  wheelRelatives: number[];
  familyRelatives: number[];
  sectionRelatives: number[];
}

const keyFor = (groups: Record<string, number[]>, n: number) =>
  Object.keys(groups).find((k) => groups[k]!.includes(n))!;

export const PROFILES: Record<number, StructuralProfile> = Object.fromEntries(
  ALL_NUMBERS.map((n) => {
    const wheelGroup = keyFor(WHEEL_GROUPS, n);
    const family = `F${n % 10}`;
    const section = `S${digitalRoot(n)}`;
    return [
      n,
      {
        number: n,
        wheelGroup,
        family,
        section,
        wheelPosition: WHEEL_GROUPS[wheelGroup]!.indexOf(n) + 1,
        familyPosition: FAMILY_GROUPS[family]!.indexOf(n) + 1,
        sectionPosition: SECTION_GROUPS[section]!.indexOf(n) + 1,
        wheelRelatives: WHEEL_GROUPS[wheelGroup]!.filter((x) => x !== n),
        familyRelatives: FAMILY_GROUPS[family]!.filter((x) => x !== n),
        sectionRelatives: SECTION_GROUPS[section]!.filter((x) => x !== n),
      },
    ];
  }),
);

export const profileOf = (n: number): StructuralProfile => PROFILES[n]!;

export const groupsOf = (kind: StructureKind): Record<string, number[]> =>
  kind === "wheel" ? WHEEL_GROUPS : kind === "family" ? FAMILY_GROUPS : SECTION_GROUPS;

export const keysOf = (kind: StructureKind): string[] =>
  kind === "wheel" ? WHEEL_KEYS : kind === "family" ? FAMILY_KEYS : SECTION_KEYS;

export const groupOfNumber = (kind: StructureKind, n: number): string =>
  kind === "wheel"
    ? profileOf(n).wheelGroup
    : kind === "family"
      ? profileOf(n).family
      : profileOf(n).section;

/* ------------------------------------------------------------------ */
/* Historical structural sequence                                      */
/* ------------------------------------------------------------------ */

export interface StructuredDraw {
  id: string;
  date: string;
  session: SessionKey;
  /** Position of the session inside the day: 0 Brunch … 3 Tea Time. */
  order: number;
  numbers: number[];
  /** Bonus is kept strictly separate from the main six. */
  bonus: number | null;
  wheels: string[];
  families: string[];
  sections: string[];
}

const sessionIdx = (s: string) => SESSIONS.indexOf(s as SessionKey);

/** Oldest → newest, preserving the real Brunch → Lunch → Drive Time → Tea Time order. */
export function structuralSequence(history: Draw[]): StructuredDraw[] {
  return [...history]
    .sort((a, b) =>
      a.draw_date === b.draw_date
        ? sessionIdx(a.session) - sessionIdx(b.session)
        : a.draw_date < b.draw_date
          ? -1
          : 1,
    )
    .map((d) => {
      const numbers = drawNumbers(d);
      return {
        id: d.id,
        date: d.draw_date,
        session: d.session,
        order: sessionIdx(d.session),
        numbers,
        bonus: d.booster ?? null,
        wheels: Array.from(new Set(numbers.map((n) => profileOf(n).wheelGroup))),
        families: Array.from(new Set(numbers.map((n) => profileOf(n).family))),
        sections: Array.from(new Set(numbers.map((n) => profileOf(n).section))),
      };
    });
}

export const structureKeys = (kind: StructureKind, d: StructuredDraw): string[] =>
  kind === "wheel" ? d.wheels : kind === "family" ? d.families : d.sections;

/** How many of a draw's six numbers sit in each group. */
export function groupCounts(kind: StructureKind, numbers: number[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(keysOf(kind).map((k) => [k, 0]));
  for (const n of numbers) out[groupOfNumber(kind, n)] = (out[groupOfNumber(kind, n)] ?? 0) + 1;
  return out;
}

export interface ActiveGroup {
  key: string;
  /** Members of the group that landed in the reference draw(s). */
  hits: number[];
  count: number;
  /** Share of the recent window in which the group was present, 0..1. */
  recentRate: number;
}

/**
 * Which structures are currently "active": present in the most recent draw,
 * annotated with how often they show up across the recent window.
 */
export function activeGroups(
  kind: StructureKind,
  sequence: StructuredDraw[],
  window = 40,
): ActiveGroup[] {
  const last = sequence[sequence.length - 1];
  if (!last) return [];
  const recent = sequence.slice(-window);
  const presence: Record<string, number> = Object.fromEntries(keysOf(kind).map((k) => [k, 0]));
  for (const d of recent)
    for (const k of structureKeys(kind, d)) presence[k] = (presence[k] ?? 0) + 1;

  return structureKeys(kind, last)
    .map((key) => {
      const hits = last.numbers.filter((n) => groupOfNumber(kind, n) === key);
      return {
        key,
        hits,
        count: hits.length,
        recentRate: (presence[key] ?? 0) / Math.max(recent.length, 1),
      };
    })
    .sort((a, b) => b.count - a.count || b.recentRate - a.recentRate);
}
