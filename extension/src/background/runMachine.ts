/**
 * Run state machine — persisted in chrome.storage.session so it survives
 * service worker restarts (MV3 workers are short-lived).
 */
import type { PageSnapshot, ProposedAction, FrameSnapshot, StepEntry, RunStatus, Action, FieldKind } from '../shared/types'
import type { ExtensionMessage } from '../shared/messages'
import * as api from './api'

// ── State ─────────────────────────────────────────────────────────────────────

export interface RunState {
  runId: string
  tabId: number
  state: RunStatus
  snapshot: PageSnapshot | null
  actions: ProposedAction[]
  currentIdx: number     // next action awaiting approval
  stepLog: StepEntry[]
  stepSeq: number
  error?: string
}

let _abortController: AbortController | null = null

// ── Persistence ───────────────────────────────────────────────────────────────

async function saveState(s: RunState): Promise<void> {
  await chrome.storage.session.set({ runState: s })
}

async function loadState(): Promise<RunState | null> {
  const data = await chrome.storage.session.get('runState')
  return (data.runState as RunState) ?? null
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startRun(tabId: number): Promise<void> {
  // Abort any in-flight previous run
  _abortController?.abort()
  _abortController = new AbortController()
  const signal = _abortController.signal

  const initial: RunState = {
    runId: '',
    tabId,
    state: 'reading',
    snapshot: null,
    actions: [],
    currentIdx: 0,
    stepLog: [],
    stepSeq: 0,
  }
  await saveState(initial)
  broadcast({ kind: 'RUN_STATUS', status: 'reading' })

  try {
    // 1. Extract all frames — retry up to 3× with backoff for React-rendered forms
    let snapshot = await extractAllFrames(tabId, signal)
    for (let attempt = 1; attempt < 3 && snapshot.fields.length === 0; attempt++) {
      if (signal.aborted) return
      await new Promise((r) => setTimeout(r, 1500 * attempt))
      snapshot = await extractAllFrames(tabId, signal)
    }
    if (signal.aborted) return
    if (!snapshot.fields.some((f) => f.visible)) {
      throw new Error('No form fields found on this page. Open the application form step and press Activate again.')
    }

    initial.snapshot = snapshot
    await saveState(initial)
    broadcast({ kind: 'RUN_UPDATE', snapshot })

    // 2. Create run on server
    initial.state = 'planning'
    broadcast({ kind: 'RUN_STATUS', status: 'planning' })

    const runId = await api.createRun(
      tabId, snapshot.url, snapshot.title, snapshot.company, snapshot.jobTitle, signal,
    )
    if (signal.aborted) return
    initial.runId = runId
    await saveState(initial)

    // 3. Plan
    const actions = await api.planRun(runId, snapshot, signal)
    if (signal.aborted) return

    addStep(initial, {
      kind: 'read_page',
      status: 'ok',
      message: `Read page — found ${snapshot.fields.filter((f) => f.visible).length} fields`,
    })

    initial.actions = actions
    initial.currentIdx = 0
    if (actions.length === 0) {
      initial.state = 'done'
      await saveState(initial)
      await api.finishRun(runId, 'completed').catch(() => {})
      broadcast({ kind: 'RUN_STATUS', status: 'done', message: 'Nothing to fill on this page' })
      return
    }
    initial.state = 'awaiting_approval'
    await saveState(initial)

    broadcast({ kind: 'PLAN_READY', runId, actions })
    broadcast({ kind: 'RUN_STATUS', status: 'awaiting_approval', currentIdx: 0 })
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    const msg = String(err)
    const s = await loadState()
    if (s) { s.state = 'error'; s.error = msg; await saveState(s) }
    broadcast({ kind: 'RUN_STATUS', status: 'error', message: msg })
  }
}

export async function approveAction(idx: number, editedValue?: string): Promise<void> {
  const s = await loadState()
  if (!s || s.state !== 'awaiting_approval') return
  if (idx !== s.currentIdx) return

  const proposed = s.actions[idx]
  if (!proposed) return

  const action = proposed.action.type === 'fill' && editedValue !== undefined
    ? { ...proposed.action, value: editedValue }
    : proposed.action
  if (action.type === 'ask_user') return // waiting for an answer, not approve
  if (action.type === 'skip') {
    addStep(s, { kind: 'skip', status: 'skipped', agentId: action.agentId, message: action.reason })
    await advance(s)
    return
  }

  s.state = 'filling'
  await saveState(s)
  broadcast({ kind: 'RUN_STATUS', status: 'filling', currentIdx: s.currentIdx })

  const signal = _abortController?.signal

  try {
    // Send fill action to the right frame
    const frameId = _frameIdForAgentId(s.snapshot, action.agentId)
    const result = await sendFillToFrame(s.tabId, frameId, action, s.runId, idx, signal)
    if (signal?.aborted) return

    const fieldLabel = s.snapshot?.fields.find((f) => f.agentId === action.agentId)?.label ?? ''
    addStep(s, {
      kind: 'fill',
      status: result.success ? 'ok' : 'failed',
      agentId: action.agentId,
      fieldLabel,
      value: result.success ? result.actualValue : undefined,
      source: proposed.source,
      confidence: proposed.confidence,
      message: result.success
        ? `Filled "${fieldLabel}"`
        : `Failed "${fieldLabel}": ${result.error}`,
    })

    broadcast({ kind: 'ACTION_FILLED', idx, success: result.success, error: result.error })
    await advance(s)
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    s.state = 'awaiting_approval'
    await saveState(s)
    broadcast({ kind: 'RUN_STATUS', status: 'awaiting_approval', currentIdx: s.currentIdx })
  }
}

export async function rejectAction(idx: number): Promise<void> {
  const s = await loadState()
  if (!s) return
  if (idx !== s.currentIdx) return

  const action = s.actions[idx]?.action
  const fieldLabel = s.snapshot?.fields.find((f) => f.agentId === action?.agentId)?.label ?? ''
  addStep(s, { kind: 'skip', status: 'skipped', agentId: action?.agentId, fieldLabel, message: `Skipped "${fieldLabel}"` })
  await advance(s)
}

export async function answerQuestion(idx: number, value: string, _remember: boolean): Promise<void> {
  const s = await loadState()
  if (!s) return
  if (idx !== s.currentIdx) return

  const proposed = s.actions[idx]
  if (!proposed || proposed.action.type !== 'ask_user') return

  const action = proposed.action
  const fieldLabel = s.snapshot?.fields.find((f) => f.agentId === action.agentId)?.label ?? ''

  const field = s.snapshot?.fields.find((f) => f.agentId === action.agentId)
  const fillAction = answerToAction(field?.kind, action.agentId, value)
  s.state = 'filling'
  await saveState(s)
  broadcast({ kind: 'RUN_STATUS', status: 'filling', currentIdx: s.currentIdx })

  const signal = _abortController?.signal
  const frameId = _frameIdForAgentId(s.snapshot, action.agentId)
  const result = await sendFillToFrame(s.tabId, frameId, fillAction, s.runId, idx, signal)

  addStep(s, {
    kind: 'answer',
    status: result.success ? 'ok' : 'failed',
    agentId: action.agentId,
    fieldLabel,
    value: result.success ? value : undefined,
    message: result.success ? `Answered "${fieldLabel}"` : `Failed "${fieldLabel}": ${result.error}`,
  })

  broadcast({ kind: 'ACTION_FILLED', idx, success: result.success, error: result.error })
  await advance(s)
}

export async function stop(): Promise<void> {
  _abortController?.abort()
  _abortController = null

  const s = await loadState()
  if (s) {
    addStep(s, { kind: 'stop', status: 'ok', message: 'Run stopped by user' })
    s.state = 'stopped'
    await saveState(s)
    await api.finishRun(s.runId, 'stopped').catch(() => {})
  }

  // Tell all frames to remove overlays
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tabId = s?.tabId ?? tabs[0]?.id
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { kind: 'STOP' }).catch(() => {})
  }

  broadcast({ kind: 'RUN_STATUS', status: 'stopped', message: 'Stopped' })
}

export async function getState(): Promise<RunState | null> {
  return loadState()
}

// ── Internals ─────────────────────────────────────────────────────────────────

async function advance(s: RunState): Promise<void> {
  s.currentIdx++
  if (s.currentIdx >= s.actions.length) {
    s.state = 'done'
    await saveState(s)
    await api.finishRun(s.runId, 'completed').catch(() => {})
    broadcast({ kind: 'RUN_STATUS', status: 'done', message: 'All fields processed' })
    return
  }
  s.state = 'awaiting_approval'
  await saveState(s)
  broadcast({ kind: 'RUN_STATUS', status: 'awaiting_approval', currentIdx: s.currentIdx })
}

function addStep(
  s: RunState,
  partial: Omit<StepEntry, 'seq' | 'ts'>,
): void {
  const entry: StepEntry = {
    seq: s.stepSeq++,
    ts: new Date().toISOString(),
    ...partial,
  }
  s.stepLog.push(entry)
  broadcast({ kind: 'STEP_LOGGED', entry })
}

function broadcast(msg: ExtensionMessage): void {
  chrome.runtime.sendMessage(msg).catch(() => {})
}

export function answerToAction(kind: FieldKind | undefined, agentId: string, value: string): Action {
  switch (kind) {
    case 'radio_group': return { type: 'choose_radio', agentId, optionLabel: value }
    case 'select': return { type: 'select', agentId, optionLabel: value }
    case 'checkbox': return { type: 'check', agentId, checked: /^(yes|y|true|1|checked)$/i.test(value.trim()) }
    default: return { type: 'fill', agentId, value }
  }
}

function _frameIdForAgentId(snapshot: PageSnapshot | null, agentId: string): number {
  if (!snapshot) return 0
  const field = snapshot.fields.find((f) => f.agentId === agentId)
  return field?.frameId ?? 0
}

async function sendFillToFrame(
  tabId: number,
  frameId: number,
  action: Action,
  runId: string,
  idx: number,
  signal?: AbortSignal,
): Promise<{ success: boolean; actualValue?: string; error?: string }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('AbortError', 'AbortError')); return }
    const onAbort = () => reject(new DOMException('AbortError', 'AbortError'))
    signal?.addEventListener('abort', onAbort, { once: true })

    chrome.tabs.sendMessage(
      tabId,
      { kind: 'FILL_ACTION', action, runId, idx } satisfies ExtensionMessage,
      { frameId },
      (resp) => {
        signal?.removeEventListener('abort', onAbort)
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message })
        } else {
          resolve(resp ?? { success: false, error: 'No response' })
        }
      },
    )
  })
}

async function extractAllFrames(tabId: number, signal: AbortSignal): Promise<PageSnapshot> {
  if (signal.aborted) throw new DOMException('AbortError', 'AbortError')

  const frameResults = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () => true,
  })
  const frameIds = frameResults.map((r) => r.frameId ?? 0)

  const snapshots: FrameSnapshot[] = []
  for (const frameId of frameIds) {
    if (signal.aborted) throw new DOMException('AbortError', 'AbortError')
    const snap = await requestFrameSnapshot(tabId, frameId)
    if (snap) snapshots.push(snap)
  }

  if (!snapshots.some((s) => s.frameId === 0)) {
    throw new Error('Could not read this page. Refresh the page and press Activate again.')
  }
  return merge(snapshots)
}

async function requestFrameSnapshot(tabId: number, frameId: number): Promise<FrameSnapshot | null> {
  const ask = async () => {
    const resp = await chrome.tabs.sendMessage(
      tabId,
      { kind: 'EXTRACT_REQUEST', frameId } satisfies ExtensionMessage,
      { frameId },
    )
    return resp?.kind === 'EXTRACT_RESPONSE' ? (resp.snapshot as FrameSnapshot) : null
  }
  try {
    return await ask()
  } catch {
    // Tabs opened before the extension was (re)loaded have no live content
    // script, so inject it on demand and retry once.
    try {
      await injectContentScript(tabId, frameId)
      return await ask()
    } catch {
      return null // cross-origin or restricted frame
    }
  }
}

async function injectContentScript(tabId: number, frameId: number): Promise<void> {
  const files = chrome.runtime.getManifest().content_scripts?.flatMap((cs) => cs.js ?? []) ?? []
  if (!files.length) return
  await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files })
}

function merge(frames: FrameSnapshot[]): PageSnapshot {
  const main = frames.find((f) => f.frameId === 0) ?? frames[0]
  return {
    url: main?.url ?? '',
    domain: (() => { try { return new URL(main?.url ?? '').hostname } catch { return '' } })(),
    title: main?.title ?? '',
    atsGuess: main?.atsGuess,
    jobTitle: main?.jobTitle,
    company: main?.company,
    fields: frames.flatMap((f) => f.fields),
    buttons: frames.flatMap((f) => f.buttons),
  }
}
