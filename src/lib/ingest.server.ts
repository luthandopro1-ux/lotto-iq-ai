import { SESSIONS, type SessionKey } from "@/lib/uk49";
import { serverDb } from "@/lib/db.server";
import { getProvider } from "@/lib/providers/index.server";
import type { DrawProvider, RawDraw } from "@/lib/providers/types";
import { drawId, drawOverdue, slotsUpTo, ukDate } from "@/lib/sessions";

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

/** Reject anything that is not a legal UK49s draw. */
export function validateDraw(raw: RawDraw): ValidationResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.draw_date)) return { ok: false, reason: "bad date" };
  if (!SESSIONS.includes(raw.session)) return { ok: false, reason: "bad session" };
  if (raw.numbers.length !== 6) return { ok: false, reason: "needs 6 numbers" };
  for (const n of raw.numbers) {
    if (!Number.isInteger(n) || n < 1 || n > 49)
      return { ok: false, reason: "number out of range" };
  }
  if (new Set(raw.numbers).size !== 6) return { ok: false, reason: "duplicate numbers" };
  if (
    raw.booster !== null &&
    (!Number.isInteger(raw.booster) || raw.booster < 1 || raw.booster > 49)
  ) {
    return { ok: false, reason: "booster out of range" };
  }
  const time = new Date(`${raw.draw_date}T00:00:00Z`).getTime();
  if (!Number.isFinite(time)) return { ok: false, reason: "unreal date" };
  if (time > Date.now() + 36 * 3600 * 1000) return { ok: false, reason: "future draw" };
  return { ok: true };
}

export function toRow(raw: RawDraw, provider: string) {
  const [n1, n2, n3, n4, n5, n6] = [...raw.numbers].sort((a, b) => a - b);
  return {
    draw_date: raw.draw_date,
    session: raw.session,
    n1: n1!,
    n2: n2!,
    n3: n3!,
    n4: n4!,
    n5: n5!,
    n6: n6!,
    booster: raw.booster,
    drawn_at: raw.drawn_at,
    session_verified: true,
    verified_at: new Date().toISOString(),
    provider,
    source: provider,
  };
}

export interface IngestOptions {
  mode: "recent" | "year";
  sessions?: SessionKey[];
  year?: number;
  providerId?: string;
  trigger?: string;
}

export interface IngestSummary {
  runId: string | null;
  provider: string;
  found: number;
  inserted: number;
  skipped: number;
  rejected: number;
  retries: number;
  perSession: Record<
    string,
    { found: number; inserted: number; skipped: number; rejected: number }
  >;
  errors: string[];
}

/**
 * Recent window for one session: the freshly published "latest results"
 * page first (it carries today's Brunch and Drive Time before the archive
 * does), then the rolling history archive, de-duplicated by date.
 * Each draw keeps the session of the feed it came from — the session is
 * never inferred from download order.
 */
async function fetchFreshest(provider: DrawProvider, session: SessionKey): Promise<RawDraw[]> {
  const [latest, history] = await Promise.allSettled([
    provider.fetchLatest ? provider.fetchLatest(session) : Promise.resolve([] as RawDraw[]),
    provider.fetchRecent(session),
  ]);
  const merged = new Map<string, RawDraw>();
  for (const settled of [latest, history]) {
    if (settled.status !== "fulfilled") continue;
    for (const raw of settled.value) {
      if (raw.session !== session) continue;
      if (!merged.has(raw.draw_date)) merged.set(raw.draw_date, raw);
    }
  }
  if (merged.size === 0) {
    const failed = [latest, history].find((r) => r.status === "rejected");
    if (failed && failed.status === "rejected") {
      throw failed.reason instanceof Error ? failed.reason : new Error(String(failed.reason));
    }
  }
  return [...merged.values()];
}

async function withRetry<T>(fn: () => Promise<T>, onRetry: () => void): Promise<T> {
  const attempts = 3;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        onRetry();
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Fetch from a provider, validate, and store only draws we do not already have.
 * Every run is journalled in `ingest_runs` so the dashboard can show sync health.
 */
export async function runIngest(options: IngestOptions): Promise<IngestSummary> {
  const db = serverDb(true);
  const provider = getProvider(options.providerId);
  const sessions = (options.sessions?.length ? options.sessions : provider.sessions).filter((s) =>
    provider.sessions.includes(s),
  );

  const summary: IngestSummary = {
    runId: null,
    provider: provider.id,
    found: 0,
    inserted: 0,
    skipped: 0,
    rejected: 0,
    retries: 0,
    perSession: {},
    errors: [],
  };

  const { data: run, error: runError } = await db
    .from("ingest_runs")
    .insert({
      provider: provider.id,
      mode: options.mode === "year" ? `year:${options.year ?? ""}` : options.trigger || "recent",
      status: "running",
    })
    .select("id")
    .single();
  if (runError) summary.errors.push(`sync log: ${runError.message}`);
  summary.runId = run?.id ?? null;

  for (const session of sessions) {
    const bucket = { found: 0, inserted: 0, skipped: 0, rejected: 0 };
    summary.perSession[session] = bucket;
    try {
      const raws = await withRetry(
        () =>
          options.mode === "year"
            ? provider.fetchYear(session, options.year ?? new Date().getUTCFullYear())
            : fetchFreshest(provider, session),
        () => {
          summary.retries += 1;
        },
      );

      const valid: RawDraw[] = [];
      for (const raw of raws) {
        bucket.found += 1;
        if (validateDraw(raw).ok) valid.push(raw);
        else bucket.rejected += 1;
      }
      if (valid.length === 0) continue;

      const dates = valid.map((v) => v.draw_date).sort();
      const { data: existing } = await db
        .from("draws")
        .select("draw_date")
        .eq("session", session)
        .gte("draw_date", dates[0]!)
        .lte("draw_date", dates[dates.length - 1]!);
      const have = new Set((existing ?? []).map((e) => e.draw_date));

      const fresh = valid.filter((v) => !have.has(v.draw_date));
      bucket.skipped = valid.length - fresh.length;

      for (let i = 0; i < fresh.length; i += 250) {
        const chunk = fresh.slice(i, i + 250).map((v) => toRow(v, provider.id));
        const { error } = await db
          .from("draws")
          .upsert(chunk, { onConflict: "draw_date,session", ignoreDuplicates: true });
        if (error) throw new Error(error.message);
        bucket.inserted += chunk.length;
      }
    } catch (err) {
      summary.errors.push(`${session}: ${err instanceof Error ? err.message : String(err)}`);
    }

    summary.found += bucket.found;
    summary.inserted += bucket.inserted;
    summary.skipped += bucket.skipped;
    summary.rejected += bucket.rejected;
  }

  if (summary.runId) {
    await db
      .from("ingest_runs")
      .update({
        status: summary.errors.length && summary.inserted === 0 ? "failed" : "ok",
        finished_at: new Date().toISOString(),
        found: summary.found,
        inserted: summary.inserted,
        skipped: summary.skipped,
        rejected: summary.rejected,
        retry_count: summary.retries,
        error: summary.errors.join(" | ") || null,
        detail: summary.perSession,
      })
      .eq("id", summary.runId);
  }

  return summary;
}

export interface GapReport {
  session: SessionKey;
  earliest: string | null;
  latest: string | null;
  stored: number;
  missing: string[];
}

/** Find dates with no stored draw between the first and last record we hold. */
export async function findGaps(limitPerSession = 60): Promise<GapReport[]> {
  const db = serverDb(true);
  const reports: GapReport[] = [];

  for (const session of SESSIONS) {
    const { data } = await db
      .from("draws")
      .select("draw_date")
      .eq("session", session)
      .order("draw_date", { ascending: true });
    const rows = data ?? [];
    if (rows.length === 0) {
      reports.push({ session, earliest: null, latest: null, stored: 0, missing: [] });
      continue;
    }
    const have = new Set(rows.map((r) => r.draw_date));
    const earliest = rows[0]!.draw_date;
    const latest = rows[rows.length - 1]!.draw_date;
    const missing: string[] = [];
    const cursor = new Date(`${earliest}T00:00:00Z`);
    const end = new Date(`${latest}T00:00:00Z`);
    while (cursor <= end && missing.length < limitPerSession) {
      const iso = cursor.toISOString().slice(0, 10);
      if (!have.has(iso)) missing.push(iso);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    reports.push({ session, earliest, latest, stored: rows.length, missing });
  }

  return reports;
}

/* ------------------------------------------------------------------ */
/* Catch-up: never skip a draw                                         */
/* ------------------------------------------------------------------ */

export interface MissingSlot {
  drawId: string;
  date: string;
  session: SessionKey;
  overdue: boolean;
}

/**
 * Which draw slots should exist by now but are not in the database?
 * Only slots whose draw time has already passed are considered.
 */
export async function missingSlots(days = 4, now = new Date()): Promise<MissingSlot[]> {
  const db = serverDb(true);
  const from = new Date(`${ukDate(now)}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - days);
  const fromDate = from.toISOString().slice(0, 10);

  const { data } = await db.from("draws").select("draw_date,session").gte("draw_date", fromDate);
  const have = new Set((data ?? []).map((d) => `${d.draw_date}#${d.session}`));

  return slotsUpTo(fromDate, now)
    .filter((slot) => !have.has(`${slot.date}#${slot.session}`))
    .map((slot) => ({
      drawId: drawId(slot.date, slot.session),
      date: slot.date,
      session: slot.session,
      overdue: drawOverdue(slot.date, slot.session, now),
    }));
}

export interface CatchUpReport {
  summary: IngestSummary | null;
  before: MissingSlot[];
  recovered: MissingSlot[];
  stillMissing: MissingSlot[];
}

/**
 * Recovers any draw the app missed while it was offline, for example a
 * Drive Time result. Runs before predictions are ever generated so the
 * sequence can never jump over a session.
 */
export async function catchUp(days = 4, now = new Date()): Promise<CatchUpReport> {
  const before = await missingSlots(days, now);
  if (before.length === 0) {
    return { summary: null, before, recovered: [], stillMissing: [] };
  }
  const sessions = Array.from(new Set(before.map((m) => m.session)));
  const summary = await runIngest({ mode: "recent", sessions, trigger: "catch-up" });
  const after = await missingSlots(days, now);
  const stillKeys = new Set(after.map((m) => m.drawId));
  return {
    summary,
    before,
    recovered: before.filter((m) => !stillKeys.has(m.drawId)),
    stillMissing: after,
  };
}
