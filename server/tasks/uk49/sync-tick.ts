import { defineTask } from "nitro/task";

/**
 * Runs every minute but only executes around one of the four UK49s draw
 * windows. The daily engine publishes at most one new session prediction per
 * invocation, so Brunch/Lunch share a locked prediction while Drive and Tea
 * are generated independently at their own windows.
 */
const DRAW_TIMES_MINUTES = [
  10 * 60 + 49, // Brunch
  12 * 60 + 49, // Lunch
  16 * 60 + 49, // Drive Time
  17 * 60 + 49, // Tea Time
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
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function inSyncWindow(): boolean {
  const now = londonMinutesNow();
  return DRAW_TIMES_MINUTES.some(
    (drawTime) => now >= drawTime - LEAD_MINUTES && now <= drawTime + TAIL_MINUTES,
  );
}

export default defineTask({
  meta: {
    name: "uk49:sync-tick",
    description: "Generate and publish the next UK49 prediction at each of four UK draw windows.",
  },
  async run() {
    if (!inSyncWindow()) return { result: { skipped: true } };

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
});
