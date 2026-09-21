export const SESSIONS = ["brunch", "lunch", "drivetime", "teatime"] as const;
export type SessionKey = (typeof SESSIONS)[number];

export const SESSION_LABELS: Record<SessionKey, string> = {
  brunch: "Brunch",
  lunch: "Lunch",
  drivetime: "Drive Time",
  teatime: "Tea Time",
};

/** Compare two UK49 draw slots in chronological order. */
export function compareDrawSlots(
  a: { draw_date: string; session: SessionKey },
  b: { draw_date: string; session: SessionKey },
): number {
  if (a.draw_date !== b.draw_date) return a.draw_date < b.draw_date ? -1 : 1;
  return SESSIONS.indexOf(a.session) - SESSIONS.indexOf(b.session);
}

export function isDrawBefore(
  a: { draw_date: string; session: SessionKey },
  b: { draw_date: string; session: SessionKey },
): boolean {
  return compareDrawSlots(a, b) < 0;
}

/** Approximate UK49 draw times (local UK), used for "current session". */
export const SESSION_HOURS: Record<SessionKey, number> = {
  brunch: 10,
  lunch: 12,
  drivetime: 17,
  teatime: 22,
};

export interface Draw {
  id: string;
  draw_date: string;
  session: SessionKey;
  n1: number;
  n2: number;
  n3: number;
  n4: number;
  n5: number;
  n6: number;
  booster: number | null;
  source: string | null;
  created_at: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string | null;
  rule_type: string;
  params: Record<string, unknown>;
  weight: number;
  enabled: boolean;
  notes: string | null;
}

export const drawNumbers = (d: Draw) => [d.n1, d.n2, d.n3, d.n4, d.n5, d.n6];

export function currentSession(now = new Date()): SessionKey {
  const h = now.getHours();
  if (h < 11) return "brunch";
  if (h < 14) return "lunch";
  if (h < 19) return "drivetime";
  return "teatime";
}

/** Fold any integer into the UK49 range 1-49. */
export function normalize(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  let v = Math.abs(Math.trunc(n));
  if (v === 0) return null;
  while (v > 49) v = v % 49 === 0 ? 49 : v % 49;
  return v >= 1 && v <= 49 ? v : null;
}

export const uniqueNormalized = (values: number[]): number[] => {
  const out: number[] = [];
  for (const v of values) {
    const n = normalize(v);
    if (n !== null && !out.includes(n)) out.push(n);
  }
  return out.sort((a, b) => a - b);
};
