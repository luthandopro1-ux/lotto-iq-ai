import type { LotteryGame } from "./types";

export interface RawRussiaDraw {
  drawNumber: number;
  drawDate: string;
  winningNumbers: number[];
  source: string;
}

const SIX_FORTY_FIVE_URL =
  "https://www.stoloto.ru/p/api/mobile/api/v35/service/draws/archive?game=6x45&count=18&page=1";
const SEVEN_FORTY_NINE_URL = "https://www.stoloto.ru/7x49/archive";

function parseIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1] ?? null;
}

function validateDraw(raw: RawRussiaDraw, game: LotteryGame): RawRussiaDraw {
  if (!Number.isSafeInteger(raw.drawNumber) || raw.drawNumber <= 0) throw new Error(`Invalid draw number for ${game.code}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.drawDate)) throw new Error(`Invalid draw date for ${game.code}`);
  const numbers = [...new Set(raw.winningNumbers)].sort((a, b) => a - b);
  if (numbers.length !== game.numbers_drawn) throw new Error(`Expected ${game.numbers_drawn} numbers for ${game.code}`);
  if (numbers.some((n) => !Number.isInteger(n) || n < game.number_range_min || n > game.number_range_max)) {
    throw new Error(`Number out of range for ${game.code}`);
  }
  return { ...raw, winningNumbers: numbers };
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json,text/html;q=0.9",
      "User-Agent": "LottoIQ/1.0 (+https://lottoiq.lumtechsolutions.co.za)",
    },
  });
  if (!response.ok) throw new Error(`Stoloto source returned HTTP ${response.status}`);
  return response.text();
}

export async function fetchRussiaLatest(game: LotteryGame): Promise<RawRussiaDraw[]> {
  if (game.code === "ru_5_50") throw new Error("ru_5_50 is retired; no current results are available");

  if (game.code === "ru_6_45") {
    const text = await fetchText(SIX_FORTY_FIVE_URL);
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("Stoloto 6/45 response was not valid JSON");
    }
    const draws = (payload as { draws?: unknown[] } | null)?.draws;
    if (!Array.isArray(draws)) throw new Error("Stoloto 6/45 response schema changed");
    return draws
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .filter((item) => item["completed"] === true || item["status"] === "COMPLETED")
      .map((item) => {
        const combination = item["combination"] as { structured?: unknown[] } | undefined;
        const values = Array.isArray(item["winningCombination"])
          ? item["winningCombination"]
          : Array.isArray(combination?.structured)
            ? combination.structured
            : [];
        return validateDraw(
          {
            drawNumber: Number(item["number"]),
            drawDate: parseIsoDate(item["date"]) ?? "",
            winningNumbers: values.map(Number),
            source: SIX_FORTY_FIVE_URL,
          },
          game,
        );
      });
  }

  if (game.code === "ru_7_49") {
    // The official archive is verified, but it is an undocumented HTML UI with
    // unstable markup and relative Russian date labels. Do not guess a parser:
    // fail closed until a documented Stoloto feed or a locked parser fixture is
    // available. Manual import remains supported through addRussiaDraw.
    throw new Error(`Automated 7/49 import is disabled until the official archive contract is stable: ${SEVEN_FORTY_NINE_URL}`);
  }

  throw new Error(`No provider configured for ${game.code}`);
}
