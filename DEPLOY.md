# Deploying to Cloudflare

This app is a TanStack Start + Nitro project already configured to build
straight to a Cloudflare Worker (`cloudflare-module` preset, static
assets served via the Worker's `ASSETS` binding). No adapter code is
needed — `npm run build` produces `.output/server/` (the Worker) and
`.output/public/` (static assets) plus a ready-to-use
`.output/server/wrangler.json`.

## 1. One-time setup

```bash
npm install
cp .env.example .env        # fill in real values, see below
npx wrangler login          # authenticate this machine with Cloudflare
```

## 2. Configure secrets on Cloudflare

The build only bakes in the `VITE_*` client vars. The server vars
(`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`LOVABLE_API_KEY`, `ADMIN_API_KEY`, `SYNC_WEBHOOK_SECRET`) must be set on
the Worker itself — Workers don't read `.env` at runtime:

```bash
npx wrangler secret put SUPABASE_URL --config .output/server/wrangler.json
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config .output/server/wrangler.json
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY --config .output/server/wrangler.json
npx wrangler secret put LOVABLE_API_KEY --config .output/server/wrangler.json   # optional
npx wrangler secret put ADMIN_API_KEY --config .output/server/wrangler.json    # required in production
npx wrangler secret put SYNC_WEBHOOK_SECRET --config .output/server/wrangler.json  # required in production
```

(`wrangler secret put` needs the Worker to exist first — run `npm run
deploy` once, then set secrets, then deploy again so the running Worker
picks them up. Or set them ahead of time as **plaintext vars** under
`vars` in `.output/server/wrangler.json` for the two non-secret ones —
`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` — if you'd rather not use
`wrangler secret` for those.)

## 3. Security — read this before making the URL public

This app has **no user-account system**. Read-only pages remain public,
but protected mutations and the sync webhook fail closed unless their
production secrets are configured:

- **Set `ADMIN_API_KEY`** (any long random string — `openssl rand -hex
  32`) as a Cloudflare secret. Once set, every function that writes
  data or spends AI credits (strategies, draws, Russia draw entry,
  backtests, analysis refresh, AI insights/import, ingest sync/backfill)
  requires a matching `x-admin-key` header. Open the deployed site,
  click the key icon top-right of the nav, and paste the same value in —
  it's saved in that browser's `localStorage` and attached to every
  request automatically from then on. Read-only pages (dashboards,
  history, predictions) stay public either way.
- **Set `SYNC_WEBHOOK_SECRET`** (a different long random string). The
  `/api/public/hooks/uk49s-sync` endpoint never accepts the publishable
  key as a fallback. See step 4 below — the same value goes into
  Supabase Vault as `uk49s_sync_secret`.
- Both secrets are required in production; do not publish a Worker until
  they are configured.

## 4. Build & deploy

```bash
npm run deploy
```

This runs `vite build` (regenerating `.output/`) then `wrangler deploy`
against the generated config. Subsequent deploys are the same one
command — the Worker name comes from `package.json`'s `name` field
("lotto-iq-ai"); rename it there before your first deploy if you want a
different Worker name.

## 5. Point Supabase's automatic sync at the deployed URL

The sync-window-tuning migration
(`supabase/migrations/20260906090000_uk49s_sync_window_tuning.sql`)
calls `<project_url>/api/public/hooks/uk49s-sync` via `pg_cron` +
`pg_net`. Once deployed, run this once in the Supabase SQL editor (not
committed to git — it embeds your live Worker URL and the sync secret):

```sql
select vault.create_secret('https://lotto-iq-ai.<your-subdomain>.workers.dev', 'uk49s_project_url');
select vault.create_secret('<the same value you set as SYNC_WEBHOOK_SECRET>', 'uk49s_sync_secret');
```

If you're also running a custom domain, use that URL instead of the
`workers.dev` one.

**Also disable whatever external scheduler (cron-job.org, a previous
host's cron, etc.) was hitting `/api/public/hooks/uk49s-sync` every 15
minutes** — leaving both running would double up sync calls.

## 6. Database migrations

Migrations live in `supabase/migrations/` and are plain SQL — including
`20260908090000_russia_lottery_module.sql`, which seeds the three
Russian games (`ru_5_50`, `ru_6_45`, `ru_7_49`) and is fully independent
of the UK49 tables. Apply them with the Supabase CLI against your
project:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

## Local development

```bash
npm run dev          # vite dev server, Node runtime — not the Worker
npm run preview       # preview the Vite build, still Node
```

`npm run dev`/`preview` are for iterating on the UI — they don't run
inside `workerd`, so anything that depends on Cloudflare-specific
behavior should be verified with a real `npm run deploy` (or `wrangler
dev --config .output/server/wrangler.json` after building) before
relying on it in production.
