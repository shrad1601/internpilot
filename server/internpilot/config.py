from pathlib import Path

DATA_DIR = Path.home() / "InternPilot"
DATA_DIR.mkdir(exist_ok=True)

HOST = "127.0.0.1"
PORT = 8765
