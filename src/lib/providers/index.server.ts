import type { DrawProvider } from "./types";
import { star49s } from "./star49s.server";

/** Registry — add a provider here and it becomes selectable everywhere. */
export const PROVIDERS: DrawProvider[] = [star49s];

export const DEFAULT_PROVIDER_ID = star49s.id;

export function getProvider(id?: string | null): DrawProvider {
  const found = PROVIDERS.find((p) => p.id === id);
  return found ?? star49s;
}
