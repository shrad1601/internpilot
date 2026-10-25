"""In-memory run store for Phase 2 (Phase 5 will move to SQLite)."""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Optional

from .schemas import RunCreate, StepEntry, RunFinish


class RunRecord:
    def __init__(self, run_id: str, data: RunCreate):
        self.run_id = run_id
        self.tab_id = data.tabId
        self.url = data.url
        self.title = data.title
        self.company = data.company
        self.job_title = data.jobTitle
        self.started_at = datetime.now(timezone.utc).isoformat()
        self.ended_at: Optional[str] = None
        self.status = "active"
        self.steps: list[StepEntry] = []
        self.seq = 0


_store: dict[str, RunRecord] = {}


def create(data: RunCreate) -> str:
    run_id = secrets.token_hex(8)
    _store[run_id] = RunRecord(run_id, data)
    return run_id


def get(run_id: str) -> Optional[RunRecord]:
    return _store.get(run_id)


def append_step(run_id: str, entry: StepEntry) -> bool:
    rec = _store.get(run_id)
    if not rec:
        return False
    rec.steps.append(entry)
    return True


def finish(run_id: str, status: str) -> bool:
    rec = _store.get(run_id)
    if not rec:
        return False
    rec.status = status
    rec.ended_at = datetime.now(timezone.utc).isoformat()
    return True


def list_all() -> list[RunRecord]:
    return sorted(_store.values(), key=lambda r: r.started_at, reverse=True)


def reset() -> None:
    """Test helper."""
    _store.clear()
