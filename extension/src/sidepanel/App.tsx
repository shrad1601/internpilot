import { useState, useEffect, useCallback } from 'react'
import Settings from './tabs/Settings'
import Run from './tabs/Run'
import ProfileTab from './tabs/Profile'
import type { PageSnapshot, ProposedAction, StepEntry, RunStatus } from '../shared/types'
import type { ExtensionMessage } from '../shared/messages'
import type { RunState } from '../background/runMachine'

type Tab = 'run' | 'history' | 'rules' | 'profile' | 'settings'
type ConnectionStatus = 'checking' | 'connected' | 'offline' | 'unpaired'

const SERVER = 'http://127.0.0.1:8765'

async function getToken(): Promise<string | null> {
  return new Promise((resolve) =>
    chrome.storage.local.get('ipToken', (d) =>
      resolve((d as { ipToken?: string }).ipToken ?? null),
    ),
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('run')
  const [conn, setConn] = useState<ConnectionStatus>('checking')
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [snapshot, setSnapshot] = useState<PageSnapshot | null>(null)
  const [actions, setActions] = useState<ProposedAction[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [steps, setSteps] = useState<StepEntry[]>([])
  const [runError, setRunError] = useState<string | undefined>()

  const checkConn = useCallback(async () => {
    setConn('checking')
    const token = await getToken()
    if (!token) { setConn('unpaired'); return }
    try {
      const res = await fetch(`${SERVER}/health`, { headers: { 'X-IP-Token': token } })
      if (res.status === 401) { setConn('unpaired'); return }
      setConn(res.ok ? 'connected' : 'offline')
    } catch { setConn('offline') }
  }, [])

  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  async function startServer() {
    setStarting(true)
    setStartError(null)
    try {
      const res = await chrome.runtime.sendNativeMessage('com.internpilot.launcher', { action: 'start' }) as
        { ok: boolean; error?: string } | undefined
      if (!res?.ok) setStartError(res?.error ?? 'Could not start server')
    } catch {
      setStartError('Launcher not installed — run server/install_native_host.sh')
    } finally {
      setStarting(false)
      void checkConn()
    }
  }

  useEffect(() => {
    checkConn()
    const listener = (msg: ExtensionMessage) => {
      if (msg.kind === 'RUN_STATUS') {
        setRunStatus(msg.status)
        if (msg.currentIdx !== undefined) setCurrentIdx(msg.currentIdx)
        if (msg.status === 'error') setRunError(msg.message)
        if (msg.status === 'idle' || msg.status === 'reading') {
          setActions([])
          setCurrentIdx(0)
          setSteps([])
          setRunError(undefined)
        }
      }
      if (msg.kind === 'RUN_UPDATE') {
        setSnapshot(msg.snapshot)
        setTab('run')
      }
      if (msg.kind === 'PLAN_READY') {
        setActions(msg.actions)
        setCurrentIdx(0)
      }
      if (msg.kind === 'STEP_LOGGED') {
        setSteps((prev) => [...prev, msg.entry])
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    // Restore an in-progress run if the panel was closed and reopened.
    chrome.runtime.sendMessage({ kind: 'GET_STATE' } satisfies ExtensionMessage)
      .then((s: RunState | null) => {
        if (!s) return
        setRunStatus(s.state)
        setSnapshot(s.snapshot)
        setActions(s.actions)
        setCurrentIdx(s.currentIdx)
        setSteps(s.stepLog)
        setRunError(s.error)
      })
      .catch(() => {})
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [checkConn])

  async function handleActivate() {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!activeTab?.id) return
    setRunStatus('reading')
    setRunError(undefined)
    setActions([])
    setCurrentIdx(0)
    setSteps([])
    chrome.runtime.sendMessage({ kind: 'START_RUN', tabId: activeTab.id } satisfies ExtensionMessage)
  }

  function handleStop() {
    chrome.runtime.sendMessage({ kind: 'STOP' } satisfies ExtensionMessage)
  }

  function handleApprove(idx: number, editedValue?: string) {
    if (editedValue !== undefined && actions[idx]?.action.type === 'fill') {
      const updated = actions.map((a, i) => {
        if (i !== idx) return a
        return { ...a, action: { ...a.action, value: editedValue } }
      })
      setActions(updated)
    }
    chrome.runtime.sendMessage({ kind: 'APPROVE_ACTION', idx, editedValue } satisfies ExtensionMessage)
  }

  function handleReject(idx: number) {
    chrome.runtime.sendMessage({ kind: 'REJECT_ACTION', idx } satisfies ExtensionMessage)
  }

  function handleAnswer(idx: number, value: string, remember: boolean) {
    chrome.runtime.sendMessage({ kind: 'ANSWER_QUESTION', idx, value, remember } satisfies ExtensionMessage)
  }

  const connDot = {
    checking: 'bg-gray-400', connected: 'bg-green-500',
    offline: 'bg-red-500', unpaired: 'bg-amber-400',
  }[conn]
  const connLabel = {
    checking: 'Checking…', connected: 'Server connected',
    offline: 'Server offline', unpaired: 'Re-pair needed',
  }[conn]

  const tabs: Tab[] = ['run', 'history', 'rules', 'profile', 'settings']

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 text-sm">
      <header className="bg-white border-b border-gray-200 px-3 pt-3 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-base tracking-tight">InternPilot</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${connDot}`} />
            <span className="text-xs text-gray-500">{connLabel}</span>
            {conn === 'offline' && (
              <button
                onClick={startServer}
                disabled={starting}
                className="ml-1 text-xs bg-blue-600 text-white px-2 py-0.5 rounded disabled:opacity-50 hover:bg-blue-700"
              >
                {starting ? 'Starting…' : 'Start server'}
              </button>
            )}
          </div>
        </div>
        {startError && <p className="text-xs text-red-500 mb-1">{startError}</p>}
        <nav className="flex gap-0.5">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-2.5 py-1.5 text-xs rounded-t capitalize transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              }`}>
              {t}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {tab === 'run' && (
          <Run
            runStatus={runStatus}
            snapshot={snapshot}
            actions={actions}
            currentIdx={currentIdx}
            steps={steps}
            serverConnected={conn === 'connected'}
            error={runError}
            onActivate={handleActivate}
            onStop={handleStop}
            onApprove={handleApprove}
            onReject={handleReject}
            onAnswer={handleAnswer}
          />
        )}
        {tab === 'history' && <Stub label="History" />}
        {tab === 'rules' && <Stub label="Rules" />}
        {tab === 'profile' && <ProfileTab />}
        {tab === 'settings' && <Settings onConnectionChange={checkConn} />}
      </main>
    </div>
  )
}

function Stub({ label }: { label: string }) {
  return <div className="text-center py-10 text-gray-400">{label} — coming soon.</div>
}
