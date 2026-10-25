# InternPilot

A human-in-the-loop job application copilot — a Chrome extension + local Python server that reads any job application form, plans how to fill it, and lets you approve each action before it's taken.

## What it does

- **Reads any form** — Greenhouse, Lever, Workday, SuccessFactors, iCIMS, Ashby, and custom ATS pages
- **Multi-frame extraction** — handles forms split across iframes and shadow DOM
- **8-strategy label resolution** — `label[for]`, wrapping label, `aria-labelledby`, `aria-label`, fieldset legend, nearby text, placeholder, and humanized name/id
- **Local server** — FastAPI server runs on your machine; the extension connects via a pairing code and `X-IP-Token` auth
- **Human in the loop** — every fill action requires your approval before it executes

## Project structure

```
internpilot/
├── extension/          # Chrome MV3 extension (Vite + React + TypeScript + Tailwind)
│   ├── src/
│   │   ├── background/ # Service worker
│   │   ├── content/    # Extraction, overlay, stop listener
│   │   ├── sidepanel/  # React side panel UI
│   │   └── shared/     # Types + messages
│   └── tests/          # Vitest unit tests (jsdom)
└── server/             # Python FastAPI server
    ├── internpilot/    # App code (auth, routes)
    └── tests/          # pytest
```

## Setup

### Extension

```bash
cd extension
pnpm install
pnpm build
```

Load `extension/dist` as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked).

### Server

```bash
cd server
uv sync
uv run uvicorn internpilot.main:app --port 8765
```

### Pairing

1. Start the server — it prints a 6-digit pairing code
2. Open the extension side panel (⌘⇧Y or click the toolbar icon)
3. Go to **Settings** and enter the code
4. The status dot turns green when connected

## Development

```bash
# Extension — watch mode
cd extension && pnpm dev

# Extension — run tests
cd extension && pnpm test

# Server — run tests
cd server && uv run pytest
```

## Tech stack

| Layer | Stack |
|---|---|
| Extension | Chrome MV3, Vite 5, @crxjs/vite-plugin 3, React 18, TypeScript, Tailwind CSS, pnpm |
| Server | Python 3.12, FastAPI, Pydantic v2, uvicorn, uv |
| Tests | Vitest + jsdom (extension), pytest + httpx (server) |

## Phases

- [x] **Phase 0** — scaffolding, pairing, health endpoint
- [x] **Phase 1** — multi-frame extraction, Run tab, 77-test suite
- [ ] **Phase 2** — field fill with approve/STOP loop
- [ ] **Phase 3** — LLM planner
- [ ] **Phase 4** — memory & feedback
- [ ] **Phase 5** — logs & screenshots
- [ ] **Phase 6** — record mode
- [ ] **Phase 7** — polish
