# Lotto IQ analytics foundation — Phase 1

This implementation follows the Lum Tech Solutions architecture decision dated 21 September 2026. The current React/TanStack Start, Nitro/Cloudflare Worker, Supabase Auth/RLS, and TypeScript analytics stack remains the live product architecture. No browser route calls the Python service.

## Added foundation

The shared `src/lib/analytics-contract.ts` module defines the `analytics.v1` request, response, and asynchronous-job schemas. It also identifies the current model, feature, and strategy-set versions. `src/lib/observability.server.ts` provides request IDs, operation timing, safe error classes, and SHA-256 parameter hashes. Logs intentionally exclude credentials, raw request bodies, and private strategy parameters.

The `20260921150000_analytics_phase1_foundation.sql` migration adds provenance and execution fields to `analysis_runs` and `backtests`, creates the service-only `analytics_jobs` boundary, and adds indexes for draw/session, target/created time, execution status, and job lookup. Legacy rows receive explicit version defaults and a zero parameter hash; new analysis and backtest writes store real provenance values.

The `analytics-service/` directory is a Dockerized, non-root FastAPI skeleton with health, readiness, authenticated job submission, job status, and result retrieval endpoints. It is disabled by default and uses an in-memory job store only as a boundary placeholder. It must not be enabled until durable job storage, queue/worker execution, result validation, parity tests, private networking, secret management, and rollback evidence are complete.

## Explicit non-goals

This phase does not add Next.js, Nginx, hand-rolled JWT authentication, a second identity authority, a live Python dependency, or a wholesale analytics rewrite. Expensive backtests remain bounded on the current Worker path until a measured workload is selected for migration.

## Verification

The repository CI now validates TypeScript quality, the Cloudflare dry-run, Python syntax, and the Phase 1 migration’s presence. Before activation of the Python service, the next phase must add durable job persistence and a real queue with concurrency controls.
