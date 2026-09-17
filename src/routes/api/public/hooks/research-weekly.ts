import { createFileRoute } from "@tanstack/react-router";

/**
 * Weekly research trigger. Called by pg_cron (research_weekly_tick) via
 * a dedicated secret header — never the public Supabase key.
 */
export const Route = createFileRoute("/api/public/hooks/research-weekly")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["RESEARCH_WEBHOOK_SECRET"];
        const provided = request.headers.get("x-research-secret") ?? "";
        if (!expected || provided !== expected) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        try {
          const { serverDb } = await import("@/lib/db.server");
          const { startWeeklyResearch } = await import("@/lib/research.server");
          const result = await startWeeklyResearch(serverDb());
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("research-weekly failed", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
