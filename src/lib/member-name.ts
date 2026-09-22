type SessionUser =
  | {
      email?: string | null;
      user_metadata?: Record<string, unknown> | null;
    }
  | null
  | undefined;

/** Returns the most useful non-sensitive display name available from Auth. */
export function memberDisplayName(user: SessionUser): string {
  const metadata = user?.user_metadata ?? {};
  const candidates = [
    metadata["full_name"],
    metadata["name"],
    metadata["first_name"],
    metadata["preferred_username"],
  ];
  const found = candidates.find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  if (found) return found.trim().split(/\s+/)[0]!;
  const emailName = user?.email?.split("@")[0]?.trim();
  return emailName || "there";
}
