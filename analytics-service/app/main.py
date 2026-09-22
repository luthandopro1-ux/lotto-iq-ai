"""Phase-gated Lotto IQ analytics service.

This service is intentionally disabled by default and is not called by the
Cloudflare Worker. It defines the narrow service boundary for a future measured
migration of expensive workloads; durable execution must be added before use.
"""
from __future__ import annotations

import os
import secrets
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

CONTRACT_VERSION = "analytics.v1"
MODEL_VERSION = "python-service.disabled.v1"
SERVICE_ENABLED = os.getenv("ANALYTICS_SERVICE_ENABLED", "false").lower() == "true"
SERVICE_TOKEN = os.getenv("ANALYTICS_SERVICE_TOKEN", "")

app = FastAPI(title="Lotto IQ Analytics Service", version=CONTRACT_VERSION)
_jobs: dict[str, dict[str, Any]] = {}


class JobKind(str, Enum):
    analysis = "analysis"
    backtest = "backtest"
    feature_generation = "feature-generation"
    model_evaluation = "model-evaluation"


class JobSubmit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: JobKind
    parameters_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    source_draw_watermark: str | None = None


class JobView(BaseModel):
    id: str
    contract_version: str
    kind: JobKind
    status: str
    request_id: str
    model_version: str
    parameters_hash: str
    created_at: str
    started_at: str | None = None
    finished_at: str | None = None


def require_service_token(authorization: str | None = Header(default=None)) -> str:
    if not SERVICE_ENABLED:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Analytics service is disabled")
    expected = SERVICE_TOKEN
    provided = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not expected or not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Analytics service authorization required")
    return provided


@app.get("/healthz")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "lotto-iq-analytics", "contract_version": CONTRACT_VERSION}


@app.get("/readyz")
def readiness() -> dict[str, str]:
    if not SERVICE_ENABLED:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Analytics service is disabled")
    if not SERVICE_TOKEN:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Analytics service token is not configured")
    return {"status": "ready", "contract_version": CONTRACT_VERSION}


@app.post("/v1/jobs", response_model=JobView, status_code=status.HTTP_202_ACCEPTED)
def submit_job(request: JobSubmit, _: str = Depends(require_service_token)) -> JobView:
    now = datetime.now(timezone.utc).isoformat()
    job_id = str(uuid.uuid4())
    request_id = str(uuid.uuid4())
    row = {
        "id": job_id,
        "contract_version": CONTRACT_VERSION,
        "kind": request.kind,
        "status": "queued",
        "request_id": request_id,
        "model_version": MODEL_VERSION,
        "parameters_hash": request.parameters_hash,
        "created_at": now,
        "started_at": None,
        "finished_at": None,
    }
    _jobs[job_id] = row
    return JobView(**row)


@app.get("/v1/jobs/{job_id}", response_model=JobView)
def get_job(job_id: str, _: str = Depends(require_service_token)) -> JobView:
    row = _jobs.get(job_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analytics job not found")
    return JobView(**row)


@app.get("/v1/jobs/{job_id}/result")
def get_result(job_id: str, _: str = Depends(require_service_token)) -> dict[str, Any]:
    row = _jobs.get(job_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analytics job not found")
    if row["status"] != "completed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Analytics result is not complete")
    return {"contract_version": CONTRACT_VERSION, "job_id": job_id, "result": None}
