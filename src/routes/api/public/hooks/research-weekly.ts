import { createFileRoute } from "@tanstack/react-router";

/**
 * Manual/external research trigger (Mon/Wed/Fri via the Cloudflare
 * native task in tasks/research-tick.ts is the primary path — this
 * route is a fallback only, not called by anything in normal
 * operation). Requires a dedicated secret header — never the public
 * Supabase key. The route path keeps its original name for URL
 * stability even though the trigger is no longer weekly-only.
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
          const { startResearchRun } = await import("@/lib/research.server");
          const result = await startResearchRun(serverDb());
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("research-weekly (manual trigger) failed", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
