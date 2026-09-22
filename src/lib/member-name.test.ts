import { describe, expect, it } from "vitest";
import { memberDisplayName } from "./member-name";

describe("memberDisplayName", () => {
  it("prefers the user's profile name", () => {
    expect(
      memberDisplayName({
        email: "client@example.com",
        user_metadata: { full_name: "Ada Lovelace" },
      }),
    ).toBe("Ada");
  });

  it("falls back to the email local part", () => {
    expect(memberDisplayName({ email: "client@example.com", user_metadata: {} })).toBe("client");
  });
});
