/**
 * Runs Monday 06:00 UTC (see nitro.config.ts). Replaces the Supabase
 * pg_cron version of this trigger entirely — running natively on
 * Cloudflare needs no Vault secrets, no pg_net, no incoming webhook
 * auth for the trigger itself (it's an in-process call, not an
 * external HTTP request). The research-weekly HTTP route still exists
 * for manual/external triggering if ever needed, but this is the
 * primary path now.
 */
export default {
  meta: {
    name: "research:weekly",
    description: "Weekly Manus research + comparison against our own real backtest numbers.",
  },
  async run() {
    try {
      const { serverDb } = await import("@/lib/db.server");
      const { startWeeklyResearch } = await import("@/lib/research.server");
      const result = await startWeeklyResearch(serverDb());
      return { result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("research:weekly failed", message);
      return { result: { error: message } };
    }
  },
};
