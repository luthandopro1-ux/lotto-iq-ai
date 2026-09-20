// Cloudflare-native scheduled tasks. Nitro's cloudflare-module preset
// auto-generates `triggers.crons` in the deployed Worker's wrangler.json
// from this config — no manual wrangler edits needed (and none would
// survive anyway, since that file is regenerated fresh on every build).
//
// This file lives at the repo root and is picked up by Nitro alongside
// the vite-tanstack-config wrapper's own (narrower) options — verified
// by building and checking .output/server/wrangler.json for `triggers`.
export default {
  experimental: { tasks: true },
  scheduledTasks: {
    // Every minute — cheap no-op outside the four UK49 draw windows
    // (see tasks/uk49-sync-tick.ts). Redundant safety net alongside the
    // tighter 20-second Supabase pg_cron tick; if that one is ever
    // misconfigured or paused, draws still land within ~60s here.
    "*/1 * * * *": ["uk49:sync-tick"],
    // Monday, Wednesday, Friday 06:00 UTC. This is the only place the
    // research job is triggered from; no Supabase Vault secrets needed
    // (a Supabase pg_cron version of this was scoped in an earlier
    // migration but never applied to the database — this Cloudflare-
    // native task is the sole trigger path, not a redundant second one).
    "0 6 * * 1,3,5": ["research:tick"],
  },
};
