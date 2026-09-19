import type { SessionKey } from "@/lib/uk49";
import type { DrawProvider, RawDraw } from "./types";

const BASE = "https://star49s.com/uk49s";

const SLUG: Record<SessionKey, string> = {
  brunch: "brunchtime",
  lunch: "lunchtime",
  drivetime: "drivetime",
  teatime: "teatime",
};

/** Sessions the site publishes a per-year archive for. */
const YEAR_ARCHIVE: SessionKey[] = ["lunch", "teatime"];

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

/** "Saturday 8th August 2026" -> "2026-08-08". Returns null when unparseable. */
export function parseLongDate(input: string): string | null {
  const m = /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/.exec(input);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[(m[2] ?? "").toLowerCase()];
  const year = Number(m[3]);
  if (!month || !day || day > 31 || !year) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * The site is a Next.js app that streams its data inside escaped RSC payloads.
 * Un-escape once, then pull the draw records out with a strict pattern.
 */
export function parseStar49s(html: string, session: SessionKey): RawDraw[] {
  const text = html.split('\\"').join('"');
  const re = /"balls":\[([^\]]*)\],"d_date":"([^"]+)","resultTime":"([^"]*)"/g;
  const out: RawDraw[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const balls = (match[1] ?? "")
      .split(",")
      .map((v) => Number(v.replace(/"/g, "").trim()))
      .filter((v) => Number.isFinite(v));
    const date = parseLongDate(match[2] ?? "");
    if (!date || balls.length < 6) continue;
    if (seen.has(date)) continue;
    seen.add(date);

    const time = /^\d{2}:\d{2}:\d{2}$/.test(match[3] ?? "") ? match[3] : null;
    out.push({
      draw_date: date,
      session,
      numbers: balls.slice(0, 6),
      booster: balls.length >= 7 ? (balls[6] ?? null) : null,
      drawn_at: time ? `${date}T${time}Z` : null,
    });
  }
  return out;
}

/**
 * The public "latest results" page is plain HTML and is published sooner
 * than the RSC history archive — it is the reliable source for today's
 * Brunch and Drive Time results.
 */
export function parseLatestPage(html: string, session: SessionKey): RawDraw[] {
  const text = html
    .replace(/<[^>]+>/g, "|")
    .replace(/&#x27;/g, "'")
    .replace(/\|+/g, "|");
  const re =
    /(\d{1,2}(?:st|nd|rd|th)\s+[A-Za-z]+\s+\d{4})\|(?:Winning Numbers\|)?(\d{1,2})\|(\d{1,2})\|(\d{1,2})\|(\d{1,2})\|(\d{1,2})\|(\d{1,2})\|(?:Booster|Bonus:)\|(\d{1,2})/g;
  const out: RawDraw[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const date = parseLongDate(m[1] ?? "");
    if (!date || seen.has(date)) continue;
    seen.add(date);
    out.push({
      draw_date: date,
      session,
      numbers: m.slice(2, 8).map(Number),
      booster: Number(m[8]),
      drawn_at: null,
    });
  }
  return out;
}

async function get(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; LottoIQ/1.0; +https://lumtechsolutions.co.za)",
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`Source returned ${res.status} for ${url}`);
  return res.text();
}

export const star49s: DrawProvider = {
  id: "star49s",
  label: "Star49s",
  sessions: ["brunch", "lunch", "drivetime", "teatime"],
  yearRange: [1997, new Date().getUTCFullYear() - 1],

  async fetchLatest(session: SessionKey) {
    const html = await get(`${BASE}/${SLUG[session]}-results`);
    return parseLatestPage(html, session);
  },

  async fetchRecent(session: SessionKey) {
    const html = await get(`${BASE}/${SLUG[session]}-results/history`);
    return parseStar49s(html, session);
  },

  async fetchYear(session: SessionKey, year: number) {
    if (!YEAR_ARCHIVE.includes(session)) return [];
    const html = await get(`${BASE}/${SLUG[session]}-results/${year}`);
    return parseStar49s(html, session);
  },
};
