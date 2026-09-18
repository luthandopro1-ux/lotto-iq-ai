/**
 * Runs every minute (see nitro.config.ts) but only actually does
 * anything within a short window around one of the four UK49s draw
 * times — everywhere else it's a same-millisecond no-op. This is a
 * redundant safety net: the primary tick is Supabase's pg_cron job
 * (20-second resolution, see supabase/migrations/*_uk49s_sync_window_tuning.sql).
 * If that one is ever paused or misconfigured, draws still land here
 * within about a minute instead of not at all.
 *
 * Draw times are evaluated in genuine Europe/London wall-clock time via
 * Intl.DateTimeFormat, so BST/GMT is handled correctly with no manual
 * season logic — same approach as the Postgres guard function.
 */

const DRAW_TIMES_MINUTES = [
  10 * 60 + 49, // Brunch  10:49
  12 * 60 + 49, // Lunch   12:49
  16 * 60 + 49, // Drive   16:49
  17 * 60 + 49, // Tea     17:49
];

const LEAD_MINUTES = 2;
const TAIL_MINUTES = 6;

function londonMinutesNow(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function inSyncWindow(): boolean {
  const now = londonMinutesNow();
  return DRAW_TIMES_MINUTES.some((t) => now >= t - LEAD_MINUTES && now <= t + TAIL_MINUTES);
}

export default {
  meta: {
    name: "uk49:sync-tick",
    description: "Redundant per-minute UK49 sync check around the four draw windows.",
  },
  async run() {
    if (!inSyncWindow()) {
      return { result: { skipped: true } };
    }
    try {
      const { runDailyBoard } = await import("@/lib/daily.server");
      const result = await runDailyBoard({});
      return { result: { skipped: false, ...result } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("uk49:sync-tick failed", message);
      return { result: { skipped: false, error: message } };
    }
  },
};
