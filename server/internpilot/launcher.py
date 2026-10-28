"""Chrome native-messaging host that starts the InternPilot LaunchAgent.

It accepts exactly one command, {"action": "start"}, and never runs
anything derived from the message contents.
"""
import json
import os
import struct
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import BinaryIO, Callable

LABEL = "com.internpilot.server"
PLIST = Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"
HEALTH_URL = "http://127.0.0.1:8765/health"
LAUNCHCTL = "/bin/launchctl"


def read_message(stream: BinaryIO) -> dict | None:
    raw_len = stream.read(4)
    if len(raw_len) < 4:
        return None
    (length,) = struct.unpack("<I", raw_len)
    if length > 1024 * 1024:
        return None
    return json.loads(stream.read(length).decode("utf-8"))


def write_message(stream: BinaryIO, msg: dict) -> None:
    data = json.dumps(msg).encode("utf-8")
    stream.write(struct.pack("<I", len(data)))
    stream.write(data)
    stream.flush()


def server_healthy() -> bool:
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=1) as r:
            return r.status == 200
    except Exception:
        return False


def start_server(
    run: Callable[..., subprocess.CompletedProcess] = subprocess.run,
    healthy: Callable[[], bool] = server_healthy,
    wait_s: float = 10.0,
) -> dict:
    if healthy():
        return {"ok": True, "status": "already_running"}

    target = f"gui/{os.getuid()}"
    kick = run([LAUNCHCTL, "kickstart", f"{target}/{LABEL}"], capture_output=True, text=True)
    if kick.returncode != 0:
        if not PLIST.exists():
            return {"ok": False, "error": f"LaunchAgent not installed at {PLIST}"}
        boot = run([LAUNCHCTL, "bootstrap", target, str(PLIST)], capture_output=True, text=True)
        if boot.returncode != 0:
            return {"ok": False, "error": (boot.stderr or kick.stderr).strip() or "launchctl failed"}

    deadline = time.monotonic() + wait_s
    while time.monotonic() < deadline:
        if healthy():
            return {"ok": True, "status": "started"}
        time.sleep(0.5)
    return {"ok": False, "error": "Server did not come up — check ~/InternPilot/logs/server.log"}


def handle(msg: dict | None, **kw) -> dict:
    if not isinstance(msg, dict) or msg.get("action") != "start":
        return {"ok": False, "error": "unsupported action"}
    return start_server(**kw)


def main() -> None:
    msg = read_message(sys.stdin.buffer)
    write_message(sys.stdout.buffer, handle(msg))


if __name__ == "__main__":
    main()
