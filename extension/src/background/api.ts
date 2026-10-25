import type { PageSnapshot, ProposedAction, StepEntry } from '../shared/types'

const BASE = 'http://127.0.0.1:8765'

async function getToken(): Promise<string | null> {
  return new Promise((resolve) =>
    chrome.storage.local.get('ipToken', (d) =>
      resolve((d as { ipToken?: string }).ipToken ?? null),
    ),
  )
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-IP-Token': token } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${method} ${path} → ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export async function createRun(
  tabId: number,
  url: string,
  title?: string,
  company?: string,
  jobTitle?: string,
  signal?: AbortSignal,
): Promise<string> {
  const resp = await req<{ runId: string }>('POST', '/runs', { tabId, url, title, company, jobTitle }, signal)
  return resp.runId
}

export async function planRun(
  runId: string,
  snapshot: PageSnapshot,
  signal?: AbortSignal,
): Promise<ProposedAction[]> {
  const resp = await req<{ runId: string; actions: ProposedAction[] }>(
    'POST', `/runs/${runId}/plan`, { snapshot }, signal,
  )
  return resp.actions
}

export async function logStep(
  runId: string,
  entry: Omit<StepEntry, 'seq'> & { seq: number },
  signal?: AbortSignal,
): Promise<void> {
  await req('POST', `/runs/${runId}/steps`, entry, signal)
}

export async function finishRun(
  runId: string,
  status: 'completed' | 'stopped' | 'error' | 'ready_for_submit',
  signal?: AbortSignal,
): Promise<void> {
  await req('POST', `/runs/${runId}/finish`, { status }, signal)
}
