import { useState, useEffect } from 'react'
import { SERVER, SERVER_HOST } from '../../shared/config'


interface Props {
  onConnectionChange: () => void
}

export default function Settings({ onConnectionChange }: Props) {
  const [code, setCode] = useState('')
  const [pairing, setPairing] = useState(false)
  const [paired, setPaired] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    chrome.storage.local.get('ipToken', (data) => {
      if ((data as { ipToken?: string }).ipToken) setPaired(true)
    })
  }, [])

  async function handlePair() {
    if (code.length !== 6) return
    setPairing(true)
    setError(null)
    try {
      const res = await fetch(`${SERVER}/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { detail?: string }
        setError(data.detail ?? 'Invalid code')
        return
      }
      const data = (await res.json()) as { token: string }
      await new Promise<void>((resolve) =>
        chrome.storage.local.set({ ipToken: data.token }, resolve),
      )
      setPaired(true)
      onConnectionChange()
    } catch {
      setError('Cannot reach server. Make sure it is running.')
    } finally {
      setPairing(false)
    }
  }

  async function handleUnpair() {
    await new Promise<void>((resolve) =>
      chrome.storage.local.remove('ipToken', resolve),
    )
    setPaired(false)
    setCode('')
    onConnectionChange()
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Server Pairing
        </h2>

        {paired ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
            <span className="text-green-700 text-sm font-medium">Paired ✓</span>
            <button
              onClick={handleUnpair}
              className="text-xs text-red-500 hover:underline"
            >
              Unpair
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-600 text-xs leading-relaxed">
              Start the InternPilot server, then enter the 6-digit code it
              prints to the terminal.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="000000"
                maxLength={6}
                className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                onKeyDown={(e) => e.key === 'Enter' && handlePair()}
              />
              <button
                onClick={handlePair}
                disabled={pairing || code.length !== 6}
                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm disabled:opacity-40 hover:bg-blue-700 transition-colors"
              >
                {pairing ? 'Pairing…' : 'Pair'}
              </button>
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Server
        </h2>
        <p className="text-xs text-gray-500 font-mono">{SERVER_HOST}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Extension build
        </h2>
        <p className="text-xs text-gray-500 font-mono">{__BUILD_TIME__}</p>
      </section>
    </div>
  )
}
