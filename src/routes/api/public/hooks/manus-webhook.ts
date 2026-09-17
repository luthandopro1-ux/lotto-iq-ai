import { createFileRoute } from "@tanstack/react-router";
import type { ManusTaskStoppedPayload } from "@/lib/manus-gateway.server";

/**
 * Receives task_stopped events from Manus. Must respond within 10s and
 * return 2xx or Manus disables the webhook after repeated failures.
 * Signature verification per https://open.manus.ai/docs/v2/webhooks-security —
 * every request is RSA-SHA256 signed, verified against Manus's public key.
 */
export const Route = createFileRoute("/api/public/hooks/manus-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-webhook-signature") ?? "";
        const timestamp = request.headers.get("x-webhook-timestamp") ?? "";

        if (!signature || !timestamp) {
          return Response.json({ error: "Missing signature headers" }, { status: 400 });
        }

        try {
          const { verifyManusWebhookSignature } = await import("@/lib/manus-gateway.server");
          const valid = await verifyManusWebhookSignature({
            url: request.url,
            rawBody,
            signatureB64: signature,
            timestamp,
          });
          if (!valid) {
            return Response.json({ error: "Invalid signature" }, { status: 401 });
          }

          const payload = JSON.parse(rawBody) as ManusTaskStoppedPayload;
          if (payload.event_type !== "task_stopped") {
            // task_created / task_progress — nothing to store yet.
            return Response.json({ ok: true, ignored: payload.event_type });
          }

          const { serverDb } = await import("@/lib/db.server");
          const { completeResearchReport, failResearchReport } =
            await import("@/lib/research.server");
          const db = serverDb();
          const detail = payload.task_detail;

          if (detail.stop_reason && detail.stop_reason !== "finish") {
            await failResearchReport(db, detail.task_id, `Stopped: ${detail.stop_reason}`);
          } else {
            await completeResearchReport(
              db,
              detail.task_id,
              detail.message ?? "",
              detail.structured_output?.success ? detail.structured_output.value : null,
            );
          }

          return Response.json({ ok: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("manus-webhook failed", message);
          // Still 200 — a 5xx here makes Manus retry, and a malformed
          // payload won't parse any better on retry.
          return Response.json({ ok: false, error: message });
        }
      },
    },
  },
});
