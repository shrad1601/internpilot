import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

from . import auth, runs, resolver, profile as profile_mod
from .schemas import (
    HealthResponse, PairRequest, PairResponse,
    RunCreate, RunResponse, PlanRequest, PlanResponse,
    StepEntry, RunFinish, Profile,
)

logger = logging.getLogger(__name__)
VERSION = "0.2.0"


def _print_code(code: str, headline: str) -> None:
    print(f"\n{'='*44}", flush=True)
    print(f"  InternPilot {VERSION} — {headline}", flush=True)
    print(f"  Pairing code : {code}", flush=True)
    print("  Code expires in 5 minutes", flush=True)
    print("  Listening on  127.0.0.1:8765", flush=True)
    print(f"{'='*44}\n", flush=True)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    restored = auth.load_persisted_token()
    code = auth.init_pairing()
    headline = "server started (existing pairing restored)" if restored else "server started"
    _print_code(code, headline)
    yield


app = FastAPI(title="InternPilot", version=VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _require_token(x_ip_token: Optional[str] = Header(default=None)) -> str:
    if not x_ip_token or not auth.verify_token(x_ip_token):
        raise HTTPException(status_code=401, detail="Invalid or missing token")
    return x_ip_token


# ── Health + pairing ──────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health(token: str = Header(alias="x-ip-token", default=None)):
    if token and not auth.verify_token(token):
        raise HTTPException(status_code=401, detail="Invalid or missing token")
    return HealthResponse(status="ok", version=VERSION)


@app.post("/pair", response_model=PairResponse)
async def pair(req: PairRequest):
    if auth.code_expired():
        _print_code(auth.init_pairing(), "new pairing code (previous one expired)")
        raise HTTPException(
            status_code=400,
            detail="Code expired — a new code was printed to the server log",
        )
    token = auth.pair_with_code(req.code)
    if token is None:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    return PairResponse(token=token)


# ── Profile ───────────────────────────────────────────────────────────────────

@app.get("/profile", response_model=Profile)
async def get_profile(token: str = Header(alias="x-ip-token", default=None)):
    _require_token(token)
    return profile_mod.load()


@app.put("/profile", response_model=Profile)
async def put_profile(body: Profile, token: str = Header(alias="x-ip-token", default=None)):
    _require_token(token)
    profile_mod.save(body)
    return body


# ── Runs ──────────────────────────────────────────────────────────────────────

@app.post("/runs", response_model=RunResponse)
async def create_run(body: RunCreate, token: str = Header(alias="x-ip-token", default=None)):
    _require_token(token)
    run_id = runs.create(body)
    return RunResponse(runId=run_id)


@app.post("/runs/{run_id}/plan", response_model=PlanResponse)
async def plan_run(
    run_id: str,
    body: PlanRequest,
    token: str = Header(alias="x-ip-token", default=None),
):
    _require_token(token)
    rec = runs.get(run_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="Run not found")
    rec.fields = [
        f.model_dump(include={"agentId", "kind", "label", "labelSources", "sectionHeading",
                              "helpText", "required", "visible", "options"})
        for f in body.snapshot.fields
    ]

    proposed = resolver.resolve(body.snapshot)

    # Log the propose step
    step = StepEntry(
        runId=run_id,
        seq=0,
        ts=datetime.now(timezone.utc).isoformat(),
        kind="propose",
        status="ok",
        message=f"Proposed {len(proposed)} actions",
    )
    runs.append_step(run_id, step)

    return PlanResponse(runId=run_id, actions=proposed)


@app.post("/runs/{run_id}/steps")
async def add_step(
    run_id: str,
    body: StepEntry,
    token: str = Header(alias="x-ip-token", default=None),
):
    _require_token(token)
    if not runs.append_step(run_id, body):
        raise HTTPException(status_code=404, detail="Run not found")
    return {"ok": True}


@app.post("/runs/{run_id}/finish")
async def finish_run(
    run_id: str,
    body: RunFinish,
    token: str = Header(alias="x-ip-token", default=None),
):
    _require_token(token)
    if not runs.finish(run_id, body.status):
        raise HTTPException(status_code=404, detail="Run not found")
    return {"ok": True}


@app.get("/runs")
async def list_runs(token: str = Header(alias="x-ip-token", default=None)):
    _require_token(token)
    return [
        {
            "runId": r.run_id,
            "url": r.url,
            "company": r.company,
            "jobTitle": r.job_title,
            "status": r.status,
            "startedAt": r.started_at,
            "endedAt": r.ended_at,
            "steps": len(r.steps),
        }
        for r in runs.list_all()
    ]


@app.get("/runs/{run_id}")
async def get_run(run_id: str, token: str = Header(alias="x-ip-token", default=None)):
    _require_token(token)
    rec = runs.get(run_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return {
        "runId": rec.run_id,
        "url": rec.url,
        "company": rec.company,
        "jobTitle": rec.job_title,
        "status": rec.status,
        "startedAt": rec.started_at,
        "endedAt": rec.ended_at,
        "steps": [s.model_dump() for s in rec.steps],
        "fields": rec.fields,
    }
