import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled sync endpoint. Called by the daily cron job.
 * Public prefix, so it validates the backend key itself.
 */
export const Route = createFileRoute("/api/public/hooks/uk49s-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const dedicated = process.env["SYNC_WEBHOOK_SECRET"];
        // Never fall back to a publishable/anon key: it is public by design.
        if (!dedicated) {
          return Response.json({ error: "Sync endpoint is not configured" }, { status: 503 });
        }
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (provided !== dedicated) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        try {
          const { runDailyBoard } = await import("@/lib/daily.server");
          const result = await runDailyBoard({});
          return Response.json({
            ok: true,
            date: result.date,
            syncErrors: result.syncErrors,
            sessions: result.board.map((b) => ({
              session: b.session,
              hasPrediction: Boolean(b.prediction),
              state: b.state,
              status: b.prediction?.status ?? null,
              drawn: Boolean(b.draw),
            })),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("uk49s-sync failed", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
