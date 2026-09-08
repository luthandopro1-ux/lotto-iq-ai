import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled sync endpoint. Called by the daily cron job.
 * Public prefix, so it validates the backend key itself.
 */
export const Route = createFileRoute("/api/public/hooks/uk49s-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Prefer a dedicated secret (never shipped to the browser). Falls
        // back to the publishable key only if SYNC_WEBHOOK_SECRET isn't
        // set yet, so existing deployments keep working — but the
        // publishable key is, by definition, public (it's in the client
        // bundle), so anyone can currently trigger this endpoint until
        // SYNC_WEBHOOK_SECRET is configured. Set it before relying on
        // this for anything beyond "someone re-ran a harmless sync".
        const dedicated = process.env["SYNC_WEBHOOK_SECRET"];
        const expected = dedicated || process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"];
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!expected || provided !== expected) {
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
