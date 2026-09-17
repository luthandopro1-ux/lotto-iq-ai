/**
 * Manus AI gateway — https://open.manus.ai/docs/v2
 *
 * Manus is an autonomous research agent, not a fast structured-output
 * API: task.create returns immediately with a task_id, then the agent
 * works in the background (minutes, not milliseconds) and reports back
 * via webhook when it stops. That's the right shape for a weekly
 * background research/comparison job — wrong shape for "parse this CSV
 * and show me the result now" (see ai-gateway.server.ts for that).
 */

const BASE = "https://api.manus.ai";

function requireKey(): string {
  const key = process.env["MANUS_API_KEY"];
  if (!key) throw new Error("Manus is not configured on this project (MANUS_API_KEY missing).");
  return key;
}

export interface ManusTaskResult {
  taskId: string;
  taskTitle: string;
  taskUrl: string;
}

/** Creates a new Manus task from a plain-text prompt. Runs asynchronously. */
export async function createManusTask(prompt: string): Promise<ManusTaskResult> {
  const key = requireKey();
  const res = await fetch(`${BASE}/v2/task.create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-manus-api-key": key },
    body: JSON.stringify({
      message: { content: [{ type: "text", text: prompt }] },
    }),
  });

  const json = (await res.json()) as {
    ok?: boolean;
    task_id?: string;
    task_title?: string;
    task_url?: string;
    error?: { code?: string; message?: string };
  };

  if (!res.ok || !json.ok || !json.task_id) {
    throw new Error(`Manus task.create failed: ${json.error?.message ?? res.statusText}`);
  }

  return { taskId: json.task_id, taskTitle: json.task_title ?? "", taskUrl: json.task_url ?? "" };
}

/** Fetches Manus's RSA public key for webhook signature verification. Rarely changes — safe to call fresh each time given how infrequently webhooks fire here (weekly). */
export async function getManusWebhookPublicKey(): Promise<string> {
  const key = requireKey();
  const res = await fetch(`${BASE}/v2/webhook.publicKey`, {
    headers: { "x-manus-api-key": key },
  });
  const json = (await res.json()) as { ok?: boolean; public_key?: string };
  if (!res.ok || !json.ok || !json.public_key) {
    throw new Error("Could not fetch Manus webhook public key.");
  }
  return json.public_key;
}

/**
 * Verifies an incoming Manus webhook request per their RSA-SHA256 scheme:
 * signed content = `${timestamp}.${url}.${sha256_hex(rawBody)}`,
 * verified against the cached public key. Rejects requests older than
 * 5 minutes to prevent replay.
 */
export async function verifyManusWebhookSignature(options: {
  url: string;
  rawBody: string;
  signatureB64: string;
  timestamp: string;
}): Promise<boolean> {
  const { url, rawBody, signatureB64, timestamp } = options;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const { createHash, createVerify } = await import("node:crypto");
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const signedContent = `${timestamp}.${url}.${bodyHash}`;

  try {
    const publicKey = await getManusWebhookPublicKey();
    const verifier = createVerify("RSA-SHA256");
    verifier.update(signedContent);
    return verifier.verify(publicKey, signatureB64, "base64");
  } catch {
    return false;
  }
}

export interface ManusTaskStoppedPayload {
  event_type: string;
  task_detail: {
    task_id: string;
    task_title?: string;
    task_url?: string;
    message?: string;
    stop_reason?: string;
    structured_output?: { success?: boolean; value?: unknown };
  };
}
