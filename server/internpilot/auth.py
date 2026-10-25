import random
import secrets
import time
from dataclasses import dataclass, field
from typing import Optional

CODE_TTL = 300  # seconds


@dataclass
class _PairingState:
    code: str
    token: str
    created_at: float = field(default_factory=time.time)
    used: bool = False


_pending: Optional[_PairingState] = None
_active_token: Optional[str] = None


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
    return _active_token


def verify_token(token: str) -> bool:
    if _active_token is None:
        return False
    return secrets.compare_digest(_active_token, token)


def reset() -> None:
    """Test helper — reset all state."""
    global _pending, _active_token
    _pending = None
    _active_token = None
