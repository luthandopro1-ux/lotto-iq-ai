import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/russia-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SYNC_WEBHOOK_SECRET"];
        if (!secret) return Response.json({ error: "Sync endpoint is not configured" }, { status: 503 });
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (provided !== secret) return Response.json({ error: "Unauthorized" }, { status: 401 });

        try {
          const { serverDb } = await import("@/lib/db.server");
          const { syncAllRussiaGames } = await import("@/lib/russia/sync.server");
          const results = await syncAllRussiaGames(serverDb());
          const failed = results.some((result) => result.status === "failed");
          return Response.json({ ok: !failed, results }, { status: failed ? 502 : 200 });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("russia-sync failed", message);
          return Response.json({ ok: false, error: "Russia sync failed" }, { status: 500 });
        }
      },
    },
  },
});
