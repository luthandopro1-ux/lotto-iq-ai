# Handover Report

**Branch:** `chore/remove-lovable-and-dead-ai` (based on `main` at `ccad584`)
**Scope:** remove the Lovable AI gateway features, the Lovable scaffold and telemetry, and the vendor Vite wrapper.

## State

Three commits, each independently revertible.

| Commit | Change |
| --- | --- |
| `chore: remove AI features that depended on the Lovable gateway` | Deleted `src/lib/ai-gateway.server.ts` and `src/lib/ai.functions.ts`. Removed the "AI insights" button and panel from `analysis.tsx` and the "AI smart import" panel from `draws.tsx`. Removed `LOVABLE_API_KEY` from `.env.example` and `DEPLOY.md`. |
| `chore: remove Lovable scaffold and telemetry` | Deleted `.lovable/`, `src/lib/lovable-error-reporting.ts` and `src/integrations/supabase/previewAuthStorage.ts`. Removed their call sites in `__root.tsx` and `supabase/client.ts`. |
| `build: replace vendor Vite wrapper with explicit plugins` | `vite.config.ts` now lists the plugins directly. Removed `@lovable.dev/vite-tanstack-config` from `package.json` and the lockfile. Removed the `@lovable.dev/*` entries from `bunfig.toml`. |

Behavior changes a reviewer should confirm:

- The Draws page no longer has the AI paste importer. Draws arrive through the automatic sync panel or the manual form.
- The Analysis page no longer has the AI insights panel. The ranked candidates panel now uses the full width.
- Supabase auth storage is the library default. On any non-Lovable host the removed helper returned `localStorage`, which is also the default.

## Vite config

The wrapper supplied the Nitro plugin, which generates `.output/server/wrangler.json` and the scheduled-task triggers. `vite.config.ts` keeps the Nitro plugin (build only, `cloudflare-module` default), the `server.entry` override, import protection, the `@` alias, React and TanStack Query dedupe, the `VITE_*` defines, lightningcss and the dev server host and port. Plugins already in `package.json` were not reinstalled.

## Verification

- `npm run typecheck`, `npm test` (62 tests, also with `TZ=Pacific/Auckland`), `npm run lint` (0 errors, 6 existing warnings in `src/components/ui`), `npm run build`, `git diff --check` and the conflict-marker scan all pass.
- Build before and after the Vite config change, same directory: client output 65 files and 1,736,209 bytes in both, server output 154 files and 4,196,544 bytes in both. `wrangler.json` differs only in `compatibility_date` (the build day). Crons are `*/1 * * * *` and `0 6 * * 1,3,5` in both. Both scheduled tasks compile into the server bundle.
- `vite dev` served `/`, `/analysis`, `/draws` and `/predictions` with HTTP 200. The sandbox has no IPv6, so it was started with `--host 127.0.0.1`.

## Unresolved

- Not deployed and nothing pushed to `main`.
- Layout changes on the Analysis and Draws pages were not checked visually in a browser.
- `LOVABLE_API_KEY` may still exist as a Cloudflare Worker secret. It is unused now and can be deleted.
- `draws.source = 'ai-import'` rows may exist in the database. They are unaffected.
- The Worker name in `.output/server/wrangler.json` was `luthandopro1-ux-lotto-iq-ai` when built in this checkout and `lotto-iq-ai` when built in a separate git worktree. `DEPLOY.md` says it comes from `package.json`. Before the first deploy, read `name` in `.output/server/wrangler.json` and confirm it matches the live Worker, or the deploy creates a second Worker. This behaved the same before these changes.
- `.lovable/plan/lotto-iq-ai-upgrade-plan-2026-08-09.md` was moved to `docs/`. It still describes the removed AI features as existing.
- Files from the earlier audit still not read line by line: Russia engine, ingest, webhooks, auth middleware, most UI components.
