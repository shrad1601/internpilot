import io
import subprocess

from internpilot import launcher


def _proc(rc: int, stderr: str = "") -> subprocess.CompletedProcess:
    return subprocess.CompletedProcess(args=[], returncode=rc, stdout="", stderr=stderr)


def test_message_roundtrip():
    buf = io.BytesIO()
    launcher.write_message(buf, {"action": "start"})
    buf.seek(0)
    assert launcher.read_message(buf) == {"action": "start"}


def test_rejects_other_actions():
    calls = []
    res = launcher.handle({"action": "rm -rf /"}, run=lambda *a, **k: calls.append(a))
    assert res == {"ok": False, "error": "unsupported action"}
    assert calls == []


def test_already_running_does_nothing():
    calls = []
    res = launcher.handle({"action": "start"}, run=lambda *a, **k: calls.append(a), healthy=lambda: True)
    assert res["status"] == "already_running"
    assert calls == []


def test_kickstart_then_healthy():
    calls, states = [], iter([False, True])
    def run(cmd, **k):
        calls.append(cmd)
        return _proc(0)
    res = launcher.handle({"action": "start"}, run=run, healthy=lambda: next(states))
    assert res == {"ok": True, "status": "started"}
    assert calls[0][:2] == [launcher.LAUNCHCTL, "kickstart"]
    assert "-k" not in calls[0]


def test_bootstraps_when_agent_unloaded(tmp_path, monkeypatch):
    plist = tmp_path / "agent.plist"
    plist.write_text("<plist/>")
    monkeypatch.setattr(launcher, "PLIST", plist)
    calls, states = [], iter([False, True])
    def run(cmd, **k):
        calls.append(cmd)
        return _proc(113 if cmd[1] == "kickstart" else 0)
    res = launcher.handle({"action": "start"}, run=run, healthy=lambda: next(states))
    assert res["ok"]
    assert calls[1][1] == "bootstrap"


def test_reports_timeout():
    res = launcher.handle({"action": "start"}, run=lambda *a, **k: _proc(0), healthy=lambda: False, wait_s=0)
    assert not res["ok"]
