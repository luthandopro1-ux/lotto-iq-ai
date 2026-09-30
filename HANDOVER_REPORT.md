# Handover Report

**Branch:** `fix/engine-integrity` (based on `main` at `7728784`)
**Scope:** source audit of the prediction engine, wheel structure, adaptive layer, daily runner and AI call sites.

## State

Changes on this branch:

| File | Change |
| --- | --- |
| `src/lib/adaptive.ts` | `adaptiveLayer` replays only draws strictly before the target slot. Previously a past target read later draws. |
| `src/lib/engine.ts` | Day-of-month is read with `getUTCDate()` so output no longer depends on runtime timezone. A strategy weight of `0` stays `0` (it was promoted to `1`). |
| `src/lib/daily.server.ts` | A failed prediction grading update is reported in `syncErrors` and skipped. Previously it was counted as graded. |
| `src/lib/draws.functions.ts` | `draw_date` must be a real calendar date. |
| `src/lib/ensemble.ts` | Removed a duplicated return branch in `classify`. |
| `src/lib/uk49.ts` | Removed `SESSION_HOURS` and `currentSession`. They were unused after the route change and their times did not match `SESSION_SCHEDULE`. |
| `src/routes/analysis.tsx`, `ensemble.tsx`, `predictions.tsx` | Default target comes from `nextTarget()` / `ukDate()` (UK time) instead of browser-local hours and a UTC date. |
| `src/lib/integrity.test.ts` | New tests: wheel, family and section partitions of 1-49, digital root, UTC day-of-month, zero weight, adaptive no-lookahead. |

## Verification

`npm run typecheck`, `npm test` (62 tests, also run with `TZ=Pacific/Auckland`), `npm run lint` (0 errors, 6 existing warnings in `src/components/ui`), `npm run build`, `git diff --check` and the conflict-marker scan all pass. The three engine tests fail against the previous code.

## Unresolved

- Files not audited line by line: Russia engine, ingest, webhooks, auth middleware, most UI components.
- The AI gateway is called only by `smartImportDraws` and `aiInsights`. Predictions, ensemble, backtest, adaptive and Russia do not call it. Whether to add AI review to the analysis path is undecided.
- The default model identifier in `src/lib/ai-gateway.server.ts` was not verified against the gateway.
- No production database migration is included. No deployment was performed.
