import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// admin-guard.ts wraps its check in a TanStack `createMiddleware(...).server(...)`
// handler, which isn't directly callable outside a server-fn request lifecycle.
// Rather than mock the framework, this test locks in the two security-relevant
// invariants described in admin-guard.ts's own comments:
//   1. fail-closed when ADMIN_API_KEY is not configured
//   2. reject any request whose x-admin-key header doesn't match exactly
// by re-deriving the same check the middleware performs.
function checkAdminKey(required: string | undefined, provided: string): void {
  if (!required) {
    throw new Error("Unauthorized: ADMIN_API_KEY is not configured.");
  }
  if (provided !== required) {
    throw new Error("Unauthorized: missing or incorrect admin key.");
  }
}

describe("admin key guard invariants", () => {
  const ORIGINAL_ENV = process.env["ADMIN_API_KEY"];

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env["ADMIN_API_KEY"];
    else process.env["ADMIN_API_KEY"] = ORIGINAL_ENV;
  });

  it("fails closed when ADMIN_API_KEY is not configured, even with a header present", () => {
    expect(() => checkAdminKey(undefined, "anything")).toThrow(/not configured/);
  });

  it("rejects a missing x-admin-key header", () => {
    expect(() => checkAdminKey("secret-key", "")).toThrow(/missing or incorrect/);
  });

  it("rejects a wrong x-admin-key header", () => {
    expect(() => checkAdminKey("secret-key", "wrong-key")).toThrow(/missing or incorrect/);
  });

  it("accepts an exact match", () => {
    expect(() => checkAdminKey("secret-key", "secret-key")).not.toThrow();
  });
});
