# Lotto IQ AI — Upgrade Plan

## What already works (keeping it)

- Dark glassmorphism UI shell, navigation, ball components
- Database: `draws`, `strategies`, `backtests` tables with 11 seeded rule types
- Modular rule registry (`src/lib/engine.ts`) — strategies register themselves, no dashboard hard-coding
- AI smart-import (paste any messy text/CSV) and AI insights via the AI gateway
- Backtest page with comparison table and timeline chart

## What is missing (the seven gaps)

Only 1 draw is in the database, everything else is manual, there is no scheduled update, no explicit previous-3-draws context, no top-5 / pairs output, and no per-number explanation.

---

## 1. Automatic data engine

I found a working, keyless, machine-readable source: **star49s.com**, which carries the full UK49s archive from **1997 to today** for both draw sessions, plus the latest results page. Verified by actually fetching it from this environment.

Important reality check: the real UK49s game only runs **Lunchtime** and **Teatime** draws. There is no official Brunch or Drive Time UK49s draw, and no source publishes one. I will keep all four sessions in the database and UI (so your manual/AI imports still work for them), but automatic ingestion will only ever fill Lunchtime and Teatime — I will never fabricate the other two.

Build a **provider layer** so the source is swappable:

```text
src/lib/providers/
  types.ts        DrawProvider interface: fetchLatest(), fetchYear(year, session)
  star49s.ts      the verified provider
  index.ts        registry + active provider selected by env/config
```

Schema additions to `draws`: `drawn_at` (timestamp), `imported_at`, `provider`, and a unique constraint on `(draw_date, session)` for duplicate prevention. New `ingest_runs` table: started/finished time, provider, mode (backfill/update), draws found/inserted/skipped, status, error text, retry count.

Validation before every insert: exactly 6 distinct numbers, each 1–49, booster null or 1–49, date not in the future. Malformed rows are rejected and counted, never patched.

Backfill: a "Import historical data" control lets you pull a year range; it walks the archive pages, skips draws already stored, and reports what it did. Gap detection compares stored dates against the expected two-draws-per-day calendar and re-requests only the missing ones.

## 2. Automatic daily update

A public server route `/api/public/hooks/uk49s-sync` fetches the latest results, validates, upserts, and records the run. A scheduled job hits it several times a day (around and after both draw times). The dashboard shows **Last update**, **Latest draw**, and a **Connected / Updating / Error** status pill, all read from `ingest_runs`. A manual "Sync now" button calls the same code path. Failed runs are retried on the next tick and surfaced in the UI.

## 3. Previous three draws engine

New `src/lib/context.ts` builds a `DrawContext` for any target draw: previous 1, 2, 3 draws under a configurable mode (same session only, or all sessions chronologically). Every strategy receives this context, so rules can reference `prev1.n3`, `prev2.booster`, and so on. A dedicated **Previous 3 Draws** dashboard section shows the three draws and the derived stats: repeats, missing numbers, frequency, gaps, consecutives, repeated pairs, transitions, position patterns and booster relationships.

## 4 & 5. Strategy framework and your specific strategies

Extend the rule engine so each run returns not just numbers but a **trace** — the ordered calculation steps that produced them. Strategy records gain `category`, and computed historical performance (tests, matches, average, score) stored per strategy.

Implement your strategies as configurable rules with visible steps:

- **A — Date × 27**: `6 × 27 = 162` → split `16 | 2` → candidate `16`, then `16 − 2 = 14` → candidate `14`
- **B — 50 − Date**: `50 − 6 = 44`
- **C — Reverse**: `62` → `26` → `26 + 1 = 27`
- **D — Date × 49**: with a selectable normalization method (modulo, digit-split, digit-sum, fold) — no silent assumptions
- **E — 126 × Date × 27**: same configurable normalization
- **F — Six numbers + booster**: sum of N1–N6, minus booster, then a configured chain of add / subtract / multiply / split / reverse

Every intermediate value is stored and displayed.

## 6. Strategy Builder

A visual builder on the Strategies page: pick a source (Date, Day, Month, Session, N1–N6, Booster, previous draw 1/2/3 values), then chain operations (add, subtract, multiply, divide, reverse digits, split digits, digit sum, modulo, absolute difference, normalize). Live preview against the current context shows each step's output before you save. Saved builder strategies run through the same engine as built-in ones.

## 7 & 8 & 9. Agreement engine, daily analysis, daily result

`RUN DAILY ANALYSIS` executes the full pipeline: load data → resolve target draw → load previous 3 → run all active strategies → collect candidates → normalize to 1–49 → drop invalid → agreement score (how many distinct strategies produced the number, weighted) → blend historical strategy score → rank → **top 5 analytical numbers** → **top 5 ranked pairs** (pairs scored by combined agreement and historical co-occurrence).

A prominent dashboard card shows the target session, the top 5, and the top pairs. Results are persisted in a new `analysis_runs` table so the dashboard shows the latest run without recomputing, and the sync job triggers a fresh run after new data lands.

Language throughout stays: Analytical Selection, Strategy Agreement, Historical Score, Backtest Result. No prediction claims.

## 10. Why each number was selected

Click any number to open a breakdown: agreement count, the list of strategies that generated it with their individual traces, and that strategy's historical score (X matches across Y tests). All read from stored calculation records — nothing generated by the AI.

## 12 & 13. Backtesting and strategy ranking

Backtest scope: one / several / all strategies, over last 30 / 100 / 500 draws or a custom range. Metrics: number matches, pair matches, 3/4/5-number match counts, average matches per draw, agreement, performance over time, plus a random-chance baseline for comparison. Results write back to each strategy's historical performance, which feeds a **Strategy Performance** ranking table.

## 14. AI layer

AI runs strictly after the deterministic engine and receives only its actual output (candidates, traces, agreement counts, backtest metrics). It explains agreement, relative historical performance and strategy relationships, with the historical-analysis caveat.

## Technical notes

- Data ingestion runs server-side (server functions + a public sync route); parsing extracts the embedded JSON from the source pages.
- New tables: `ingest_runs`, `analysis_runs`, `strategy_performance`; `draws` gains uniqueness plus provenance columns.
- Existing pages are upgraded in place; the AI importer and manual entry stay as fallbacks.
- Tests cover normalization, each strategy's calculation, the agreement scorer, context building, provider parsing (against a saved fixture) and the backtest metrics.

## Build order

1. Schema migration + provider layer + backfill (get real history in)
2. Sync route + scheduled job + status UI
3. Context engine + strategy traces + your strategies A–F
4. Agreement + daily analysis + top 5 / pairs + explanations dashboard
5. Strategy Builder
6. Backtesting metrics + performance ranking + AI layer
7. Tests and fixes
