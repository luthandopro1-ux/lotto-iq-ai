import { SESSIONS, type SessionKey } from "./uk49";

/* ------------------------------------------------------------------ */
/* Session schedule — configuration, never hard-coded assumptions      */
/* ------------------------------------------------------------------ */

export interface SessionConfig {
  key: SessionKey;
  label: string;
  /** Slug used in the unique draw id, e.g. DRIVE_TIME. */
  id: string;
  /** Draw time in UK local time (Europe/London, DST handled automatically). */
  ukTime: string;
  /** Minutes after the draw before a missing result is treated as late. */
  graceMinutes: number;
}

export const SESSION_SCHEDULE: Record<SessionKey, SessionConfig> = {
  brunch: { key: "brunch", label: "Brunch", id: "BRUNCH", ukTime: "10:49", graceMinutes: 15 },
  lunch: { key: "lunch", label: "Lunch", id: "LUNCH", ukTime: "12:49", graceMinutes: 15 },
  drivetime: {
    key: "drivetime",
    label: "Drive Time",
    id: "DRIVE_TIME",
    ukTime: "16:49",
    graceMinutes: 15,
  },
  teatime: { key: "teatime", label: "Tea Time", id: "TEA_TIME", ukTime: "17:49", graceMinutes: 15 },
};

export const SESSION_ORDER = SESSIONS;

export const TIMEZONE = "Europe/London";

/** Unique draw identifier — DATE + SESSION, e.g. 2026-08-13_DRIVE_TIME. */
export const drawId = (date: string, session: SessionKey) =>
  `${date}_${SESSION_SCHEDULE[session].id}`;

export function parseDrawId(id: string): { date: string; session: SessionKey } | null {
  const [date, ...rest] = id.split("_");
  const slug = rest.join("_");
  const found = SESSIONS.find((s) => SESSION_SCHEDULE[s].id === slug);
  if (!date || !found || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { date, session: found };
}

/* ------------------------------------------------------------------ */
/* Timezone helpers — everything stored UTC, displayed in UK time      */
/* ------------------------------------------------------------------ */

const partsIn = (tz: string, at: Date) => {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const out: Record<string, string> = {};
  for (const p of f.formatToParts(at)) if (p.type !== "literal") out[p.type] = p.value;
  return out;
};

/** Offset of Europe/London from UTC, in minutes, at a given instant. */
export function ukOffsetMinutes(at: Date): number {
  const p = partsIn(TIMEZONE, at);
  const asUtc = Date.UTC(
    Number(p["year"]),
    Number(p["month"]) - 1,
    Number(p["day"]),
    Number(p["hour"] === "24" ? "0" : p["hour"]),
    Number(p["minute"]),
    Number(p["second"]),
  );
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Calendar date (YYYY-MM-DD) in UK local time. */
export function ukDate(at: Date = new Date()): string {
  const p = partsIn(TIMEZONE, at);
  return `${p["year"]}-${p["month"]}-${p["day"]}`;
}

/** UK wall-clock time HH:MM. */
export function ukClock(at: Date = new Date()): string {
  const p = partsIn(TIMEZONE, at);
  return `${p["hour"] === "24" ? "00" : p["hour"]}:${p["minute"]}`;
}

/** The exact UTC instant a session draws on a given UK calendar date. */
export function drawInstant(date: string, session: SessionKey): Date {
  const [hh, mm] = SESSION_SCHEDULE[session].ukTime.split(":");
  const naive = Date.parse(`${date}T${hh}:${mm}:00Z`);
  const offset = ukOffsetMinutes(new Date(naive));
  return new Date(naive - offset * 60000);
}

/** Has this session's draw time (plus grace) already passed? */
export function drawTimePassed(date: string, session: SessionKey, now = new Date()): boolean {
  return now.getTime() >= drawInstant(date, session).getTime();
}

export function drawOverdue(date: string, session: SessionKey, now = new Date()): boolean {
  return (
    now.getTime() >=
    drawInstant(date, session).getTime() + SESSION_SCHEDULE[session].graceMinutes * 60000
  );
}

/** Every date+session slot from `from` (inclusive) up to now, in draw order. */
export function slotsUpTo(from: string, now = new Date()): { date: string; session: SessionKey }[] {
  const out: { date: string; session: SessionKey }[] = [];
  const today = ukDate(now);
  const cursor = new Date(`${from}T00:00:00Z`);
  while (cursor.toISOString().slice(0, 10) <= today) {
    const date = cursor.toISOString().slice(0, 10);
    for (const session of SESSIONS) {
      if (drawTimePassed(date, session, now)) out.push({ date, session });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** The next session that has not drawn yet, from the UK "now". */
export function nextTarget(now = new Date()): { date: string; session: SessionKey } {
  const today = ukDate(now);
  for (const session of SESSIONS) {
    if (!drawTimePassed(today, session, now)) return { date: today, session };
  }
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return { date: tomorrow.toISOString().slice(0, 10), session: SESSIONS[0] };
}

/* ------------------------------------------------------------------ */
/* Per-session state machine                                           */
/* ------------------------------------------------------------------ */

export const DRAW_STATES = [
  "WAITING",
  "PREDICTION_READY",
  "DRAW_PENDING",
  "RESULT_DETECTED",
  "RESULT_VERIFIED",
  "ANALYZED",
] as const;
export type DrawState = (typeof DRAW_STATES)[number];

export const STATE_LABELS: Record<DrawState, string> = {
  WAITING: "Waiting",
  PREDICTION_READY: "Prediction ready",
  DRAW_PENDING: "Draw pending",
  RESULT_DETECTED: "Result detected",
  RESULT_VERIFIED: "Result verified",
  ANALYZED: "Analyzed",
};

export interface SessionStateInput {
  date: string;
  session: SessionKey;
  hasPrediction: boolean;
  hasResult: boolean;
  sessionVerified: boolean;
  graded: boolean;
  now?: Date;
}

/**
 * The state of one draw slot, derived from the database only —
 * never from anything the browser thinks it knows.
 */
export function sessionState(input: SessionStateInput): DrawState {
  const now = input.now ?? new Date();
  if (input.hasResult) {
    if (input.graded) return "ANALYZED";
    if (!input.sessionVerified) return "RESULT_DETECTED";
    return "RESULT_VERIFIED";
  }
  if (drawTimePassed(input.date, input.session, now)) return "DRAW_PENDING";
  if (input.hasPrediction) return "PREDICTION_READY";
  return "WAITING";
}
