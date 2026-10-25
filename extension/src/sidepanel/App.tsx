import { useState, useEffect, useCallback } from 'react'
import Settings from './tabs/Settings'

type Tab = 'run' | 'history' | 'rules' | 'profile' | 'settings'
type ConnectionStatus = 'checking' | 'connected' | 'offline' | 'unpaired'

const SERVER = 'http://127.0.0.1:8765'

async function getStoredToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get('ipToken', (data) => {
      resolve((data as { ipToken?: string }).ipToken ?? null)
    })
  })
}

export default function App() {
  const [tab, setTab] = useState<Tab>('run')
  const [status, setStatus] = useState<ConnectionStatus>('checking')

  const checkConnection = useCallback(async () => {
    setStatus('checking')
    try {
      const token = await getStoredToken()
      if (!token) {
        setStatus('unpaired')
        return
      }
      const res = await fetch(`${SERVER}/health`, {
        headers: { 'X-IP-Token': token },
      })
      setStatus(res.ok ? 'connected' : 'offline')
    } catch {
      setStatus('offline')
    }
  }, [])

  useEffect(() => {
    checkConnection()
  }, [checkConnection])

  const statusDot = {
    checking: 'bg-gray-400',
    connected: 'bg-green-500',
    offline: 'bg-red-500',
    unpaired: 'bg-amber-400',
  }[status]

  const statusLabel = {
    checking: 'Checking…',
    connected: 'Server connected',
    offline: 'Server offline',
    unpaired: 'Not paired',
  }[status]

  const tabs: Tab[] = ['run', 'history', 'rules', 'profile', 'settings']

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 text-sm">
      <header className="bg-white border-b border-gray-200 px-3 pt-3 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-base tracking-tight">InternPilot</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${statusDot}`} />
            <span className="text-xs text-gray-500">{statusLabel}</span>
          </div>
        </div>
        <nav className="flex gap-0.5">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2.5 py-1.5 text-xs rounded-t capitalize transition-colors ${
                tab === t
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {tab === 'run' && <RunTab status={status} />}
        {tab === 'history' && <StubTab label="History" />}
        {tab === 'rules' && <StubTab label="Rules" />}
        {tab === 'profile' && <StubTab label="Profile" />}
        {tab === 'settings' && (
          <Settings onConnectionChange={checkConnection} />
        )}
      </main>
    </div>
  )
}

function RunTab({ status }: { status: ConnectionStatus }) {
  if (status === 'connected') {
    return (
      <div className="text-center py-10 text-gray-500 space-y-2">
        <p className="text-base font-medium text-gray-700">Ready</p>
        <p>
          Navigate to a job application page and press{' '}
          <kbd className="bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded text-xs font-mono">
            ⌘⇧Y
          </kbd>{' '}
          to start.
        </p>
      </div>
    )
  }
  if (status === 'unpaired') {
    return (
      <div className="text-center py-10 text-gray-500">
        <p>Go to <strong>Settings</strong> to pair with the server.</p>
      </div>
    )
  }
  if (status === 'offline') {
    return (
      <div className="text-center py-10 text-gray-500">
        <p>Server is offline. Start it with:</p>
        <pre className="mt-2 bg-gray-100 rounded px-3 py-2 text-xs text-left inline-block">
          cd server && uv run python -m internpilot
        </pre>
      </div>
    )
  }
  return (
    <div className="text-center py-10 text-gray-400">
      <p>Checking server…</p>
    </div>
  )
}

function StubTab({ label }: { label: string }) {
  return (
    <div className="text-center py-10 text-gray-400">
      <p>{label} — coming soon.</p>
    </div>
  )
}
