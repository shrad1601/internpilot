# InternPilot

A human-in-the-loop job application copilot for Chrome on macOS.

## Quick start

### Server

```bash
cd server
uv sync
uv run python -m internpilot
```

The server prints a 6-digit pairing code on startup.

### Extension

```bash
cd extension
pnpm install
pnpm build
```

Load the `extension/dist` folder as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked).

Open the side panel with **⌘⇧Y** and enter the pairing code from the server.

## Development

```bash
# server (with auto-reload)
cd server && uv run uvicorn internpilot.main:app --reload --host 127.0.0.1 --port 8765

# extension (watch mode)
cd extension && pnpm dev
```

## Tests

```bash
# server
cd server && uv run pytest -v

# extension (unit)
cd extension && pnpm test
```
