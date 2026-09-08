import type { SessionKey } from "@/lib/uk49";

/** A draw exactly as it came off a provider, before validation. */
export interface RawDraw {
  draw_date: string;
  session: SessionKey;
  numbers: number[];
  booster: number | null;
  drawn_at: string | null;
}

export interface DrawProvider {
  id: string;
  label: string;
  /** Sessions this provider can actually deliver. */
  sessions: SessionKey[];
  /** Inclusive year range available through {@link DrawProvider.fetchYear}. */
  yearRange: [number, number];
  /** Freshest published results for a session (today / yesterday first). */
  fetchLatest?(session: SessionKey): Promise<RawDraw[]>;
  /** Most recent draws for a session (rolling window). */
  fetchRecent(session: SessionKey): Promise<RawDraw[]>;
  /** Full archive for one calendar year, when the provider exposes one. */
  fetchYear(session: SessionKey, year: number): Promise<RawDraw[]>;
}
