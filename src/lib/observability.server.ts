import { getRequest } from "@tanstack/react-start/server";

const REQUEST_ID_HEADERS = ["x-request-id", "cf-ray"] as const;
const MAX_ERROR_LENGTH = 1_000;

type StructuredLog = {
  event: string;
  operation: string;
  requestId: string;
  jobId?: string;
  modelVersion?: string;
  durationMs?: number;
  errorClass?: string;
  status?: "started" | "completed" | "failed";
  [key: string]: unknown;
};

function safeErrorClass(error: unknown): string {
  return error instanceof Error && error.name ? error.name : "UnknownError";
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(
      /(password|token|secret|api[-_]?key|authorization)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[redacted]",
    )
    .slice(0, MAX_ERROR_LENGTH);
}

function emit(log: StructuredLog) {
  // Never include raw strategy parameters, credentials, or request bodies here.
  console.log(
    JSON.stringify({ service: "lotto-iq-web", timestamp: new Date().toISOString(), ...log }),
  );
}

export function getRequestId(): string {
  try {
    const request = getRequest();
    for (const header of REQUEST_ID_HEADERS) {
      const value = request?.headers.get(header)?.trim();
      if (value && value.length <= 200) return value;
    }
  } catch {
    // Server functions may also run in a test or scheduled context without a request.
  }
  return crypto.randomUUID();
}

export function beginOperation(input: {
  operation: string;
  requestId?: string;
  jobId?: string;
  modelVersion?: string;
}) {
  const startedAt = Date.now();
  const requestId = input.requestId ?? getRequestId();
  emit({
    event: "operation",
    operation: input.operation,
    requestId,
    ...(input.jobId ? { jobId: input.jobId } : {}),
    ...(input.modelVersion ? { modelVersion: input.modelVersion } : {}),
    status: "started",
  });
  return {
    requestId,
    finish(fields: { status: "completed" | "failed"; error?: unknown; [key: string]: unknown }) {
      emit({
        event: "operation",
        operation: input.operation,
        requestId,
        ...(input.jobId ? { jobId: input.jobId } : {}),
        ...(input.modelVersion ? { modelVersion: input.modelVersion } : {}),
        status: fields.status,
        durationMs: Date.now() - startedAt,
        ...(fields.error
          ? {
              errorClass: safeErrorClass(fields.error),
              errorMessage: safeErrorMessage(fields.error),
            }
          : {}),
        ...Object.fromEntries(Object.entries(fields).filter(([key]) => key !== "error")),
      });
    },
  };
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

export async function hashParameters(value: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(stableValue(value)));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
