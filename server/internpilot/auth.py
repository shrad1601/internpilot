import os
import random
import secrets
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from .config import DATA_DIR

CODE_TTL = 300  # seconds
TOKEN_PATH: Path = DATA_DIR / ".token"


@dataclass
class _PairingState:
    code: str
    token: str
    created_at: float = field(default_factory=time.time)
    used: bool = False


_pending: Optional[_PairingState] = None
_active_token: Optional[str] = None


def _save_token(token: str) -> None:
    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(TOKEN_PATH, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(token)


def load_persisted_token() -> bool:
    """Restore the token from a previous pairing. Returns True if one was found."""
    global _active_token
    try:
        token = TOKEN_PATH.read_text().strip()
    except FileNotFoundError:
        return False
    if token:
        _active_token = token
        return True
    return False


def init_pairing() -> str:
    """Generate a new pairing code + token. Returns the code to print."""
    global _pending
    code = f"{random.randint(0, 999_999):06d}"
    token = secrets.token_urlsafe(32)
    _pending = _PairingState(code=code, token=token)
    return code


def get_current_code() -> Optional[str]:
    """Return the pending code if it is still valid."""
    if _pending is None or _pending.used:
        return None
    if time.time() - _pending.created_at > CODE_TTL:
        return None
    return _pending.code


def code_expired() -> bool:
    return _pending is not None and not _pending.used and time.time() - _pending.created_at > CODE_TTL


def pair_with_code(code: str) -> Optional[str]:
    """Exchange a 6-digit code for the long token. Returns None on failure."""
    global _pending, _active_token
    if _pending is None or _pending.used:
        return None
    if time.time() - _pending.created_at > CODE_TTL:
        return None
    if not secrets.compare_digest(_pending.code, code):
        return None
    _pending.used = True
    _active_token = _pending.token
    _save_token(_active_token)
    return _active_token


def verify_token(token: str) -> bool:
    if _active_token is None:
        return False
    return secrets.compare_digest(_active_token, token)


def reset() -> None:
    """Test helper — reset in-memory state."""
    global _pending, _active_token
    _pending = None
    _active_token = None
