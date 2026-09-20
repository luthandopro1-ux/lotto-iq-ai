# Capacity Monitoring

**Owner:** Lum Tech Solutions

Lotto IQ records a minute-level capacity signal without storing names, emails, IP addresses, browser fingerprints, or page-by-page activity trails. Each visible browser client sends one lightweight heartbeat approximately every 60 seconds. The database stores aggregate counts, request counts, error counts, total latency, and maximum latency for each minute. Records are retained for 35 days by the pruning function.

The administrator console reads a protected aggregate function. It shows the current active-client estimate, configured soft limit, percentage of planned capacity, average and maximum latency, errors, and the busiest hours observed during the last seven days. A normal state is shown below the warning threshold, a warning state is shown at the configured alert percentage, and a critical state is shown at the configured critical percentage. The initial soft limit is 10,000 active clients, with warning at 80% and critical at 95%.

The number is an **active browser-client estimate**, not a legally or operationally exact count of unique individuals. Multiple tabs, shared devices, disabled JavaScript, blocked beacons, bots, and network failures can affect it. It is intended to warn Lum Tech Solutions that capacity planning should begin; it must not be presented as an exact number of people.

The heartbeat endpoint is deliberately fail-open for customers: if telemetry or the database is unavailable, the endpoint returns an accepted response and customer traffic is not blocked. The endpoint should still be protected with Cloudflare rate limiting and bot controls in production because unauthenticated telemetry can be inflated by automated traffic. Capacity alerts should therefore be interpreted with request rate, error rate, latency, database health, and cache-hit ratio together.

Before release, apply `20260919220000_capacity_telemetry.sql` through the Supabase migration process. Confirm that the database role used by the telemetry RPC cannot read telemetry rows directly, verify the administrator allowlist, configure the existing database scheduler to call `prune_capacity_telemetry()` once per day, and add Cloudflare rate limits for `/api/telemetry/heartbeat`.

Before raising the 10,000-user soft limit, run a controlled load test against a production-like environment. Compare active-client estimates with synthetic clients, monitor Supabase API and Postgres limits, review p95 and p99 latency, and upgrade the database plan before the warning line becomes a sustained normal condition. The soft limit is a planning threshold, not proof of a hard technical maximum.
