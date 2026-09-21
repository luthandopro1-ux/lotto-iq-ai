# Lotto IQ analytics service (phase-gated)

This is the Phase 1 service boundary defined by the Lum Tech Solutions architecture decision. It is **disabled by default** and is not called by the Cloudflare Worker or browser. The current live analytics engines remain in TypeScript.

The skeleton defines:

- `GET /healthz` for process health;
- `GET /readyz` for activation readiness;
- `POST /v1/jobs` for authenticated asynchronous job submission;
- `GET /v1/jobs/{job_id}` for job status; and
- `GET /v1/jobs/{job_id}/result` for validated result retrieval.

Set `ANALYTICS_SERVICE_ENABLED=true` and a strong `ANALYTICS_SERVICE_TOKEN` only after durable job storage, a worker queue, result validation, parity tests against the TypeScript engine, private service networking, secret management, and rollback evidence are complete. The current in-memory job store is intentionally non-production and exists only to make the API boundary explicit.

Run locally with:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The Docker image runs as a non-root user and defaults to disabled readiness.
