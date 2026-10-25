import { useEffect, useRef } from 'react'
import type { StepEntry } from '../../shared/types'

interface Props {
  steps: StepEntry[]
}

const STATUS_COLORS: Record<string, string> = {
  ok: 'text-green-600',
  failed: 'text-red-500',
  skipped: 'text-gray-400',
  waiting: 'text-amber-500',
}

const KIND_ICONS: Record<string, string> = {
  read_page: '📄',
  fill: '✏️',
  skip: '⏭',
  answer: '💬',
  stop: '⏹',
  error: '⚠️',
  propose: '🔍',
  approve: '✓',
}

export default function StepLog({ steps }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [steps.length])

  if (steps.length === 0) return null

  return (
    <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-200">
        Step log
      </div>
      <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
        {steps.map((s) => (
          <div key={s.seq} className="flex items-start gap-2 px-3 py-1.5 text-xs">
            <span className="shrink-0 text-base leading-none mt-0.5">
              {KIND_ICONS[s.kind] ?? '·'}
            </span>
            <span className={`flex-1 ${STATUS_COLORS[s.status] ?? ''}`}>{s.message}</span>
            <span className="text-gray-300 shrink-0 font-mono">
              {new Date(s.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
