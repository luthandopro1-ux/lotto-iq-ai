import { createFileRoute } from "@tanstack/react-router";

const bodyShape = {
  latencyMs: 0,
  error: false,
  sampled: false,
};

export const Route = createFileRoute("/api/telemetry/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const latencyMs =
            typeof input["latencyMs"] === "number"
              ? Math.round(input["latencyMs"] as number)
              : bodyShape.latencyMs;
          const error = input["error"] === true;
          const sampled = input["sampled"] === true;
          const { serverDb } = await import("@/lib/db.server");
          const db = serverDb() as unknown as {
            rpc: (
              name: "record_capacity_heartbeat",
              args: {
                p_bucket_start: string;
                p_latency_ms: number;
                p_sampled: boolean;
                p_error: boolean;
              },
            ) => Promise<{ error: { message: string } | null }>;
          };
          const { error: recordError } = await db.rpc("record_capacity_heartbeat", {
            p_bucket_start: new Date().toISOString(),
            p_latency_ms: Math.max(0, Math.min(latencyMs, 30000)),
            p_sampled: sampled,
            p_error: error,
          });
          if (recordError) throw new Error(recordError.message);
          return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
        } catch (error) {
          console.warn(
            "capacity telemetry unavailable",
            error instanceof Error ? error.message : String(error),
          );
          return Response.json(
            { ok: false },
            { status: 202, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
