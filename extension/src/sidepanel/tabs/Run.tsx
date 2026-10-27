import type { PageSnapshot, ProposedAction, StepEntry, RunStatus, Field } from '../../shared/types'
import ApprovalCard from '../components/ApprovalCard'
import StepLog from '../components/StepLog'
import StopButton from '../components/StopButton'

interface Props {
  runStatus: RunStatus
  snapshot: PageSnapshot | null
  actions: ProposedAction[]
  currentIdx: number
  steps: StepEntry[]
  serverConnected: boolean
  error?: string
  onActivate: () => void
  onStop: () => void
  onApprove: (idx: number, editedValue?: string) => void
  onReject: (idx: number) => void
  onAnswer: (idx: number, value: string, remember: boolean) => void
}

export default function Run({
  runStatus, snapshot, actions, currentIdx, steps,
  serverConnected, error, onActivate, onStop,
  onApprove, onReject, onAnswer,
}: Props) {
  const isActive = runStatus !== 'idle' && runStatus !== 'done' && runStatus !== 'stopped' && runStatus !== 'error'
  const currentAction = actions[currentIdx]

  // ── Idle ───────────────────────────────────────────────────────────────────
  if (runStatus === 'idle' || (!snapshot && !isActive)) {
    return (
      <div className="text-center py-10 space-y-4">
        {!serverConnected && (
          <p className="text-amber-600 text-xs">Server offline — start it first.</p>
        )}
        <p className="text-gray-500 text-sm">
          Navigate to a job application page, then press Activate.
        </p>
        <button
          onClick={onActivate}
          disabled={!serverConnected}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          Activate
        </button>
        <p className="text-xs text-gray-400">or press ⌘⇧Y</p>
      </div>
    )
  }

  // ── Reading / planning ─────────────────────────────────────────────────────
  if (runStatus === 'reading' || runStatus === 'planning') {
    return (
      <div className="space-y-4">
        <StopButton onStop={onStop} />
        <div className="flex flex-col items-center justify-center py-8 gap-3 text-gray-500">
          <Spinner />
          <p>{runStatus === 'reading' ? 'Reading page…' : 'Planning…'}</p>
        </div>
        <StepLog steps={steps} />
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (runStatus === 'error') {
    const isAuth = error?.includes('401') || error?.includes('token')
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-red-500 text-sm">{error ?? 'Something went wrong'}</p>
        {isAuth && (
          <p className="text-xs text-amber-600">
            Token mismatch — go to <strong>Settings</strong> and re-pair with the code the server printed.
          </p>
        )}
        <button onClick={onActivate} className="text-xs text-blue-500 underline">Try again</button>
        <StepLog steps={steps} />
      </div>
    )
  }

  // ── Done / stopped ─────────────────────────────────────────────────────────
  if (runStatus === 'done' || runStatus === 'stopped') {
    const filledCount = steps.filter((s) => s.kind === 'fill' && s.status === 'ok').length
    return (
      <div className="space-y-4">
        <div className="text-center py-4 space-y-1">
          <p className="font-semibold">
            {runStatus === 'done' ? '✓ Done' : '⏹ Stopped'}
          </p>
          <p className="text-xs text-gray-500">{filledCount} field{filledCount !== 1 ? 's' : ''} filled</p>
        </div>
        <button
          onClick={onActivate}
          className="w-full text-xs text-blue-500 underline text-center"
        >
          Re-run
        </button>
        <StepLog steps={steps} />
      </div>
    )
  }

  // ── Active (awaiting_approval / filling) ───────────────────────────────────
  const progress = actions.length > 0 ? (currentIdx / actions.length) * 100 : 0

  return (
    <div className="space-y-3">
      <StopButton onStop={onStop} />

      {/* Progress bar */}
      {actions.length > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>{currentIdx} of {actions.length}</span>
            <span>{runStatus === 'filling' ? 'Filling…' : 'Awaiting approval'}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Page info */}
      {snapshot && (
        <div className="text-xs text-gray-400">
          {snapshot.company && <span className="font-medium text-gray-600">{snapshot.company}</span>}
          {snapshot.company && snapshot.jobTitle && ' — '}
          {snapshot.jobTitle}
        </div>
      )}

      {/* Current action card */}
      {currentAction && runStatus === 'awaiting_approval' && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Action {currentIdx + 1} of {actions.length}
          </p>
          <ApprovalCard
            key={currentIdx}
            idx={currentIdx}
            proposed={currentAction}
            onApprove={onApprove}
            onReject={onReject}
            onAnswer={onAnswer}
          />
        </div>
      )}

      {runStatus === 'filling' && (
        <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
          <Spinner small />
          <span>Filling field…</span>
        </div>
      )}

      {/* Field overview when snapshot available */}
      {snapshot && (
        <FieldOverview snapshot={snapshot} actions={actions} currentIdx={currentIdx} />
      )}

      <StepLog steps={steps} />
    </div>
  )
}

function FieldOverview({
  snapshot, actions, currentIdx,
}: {
  snapshot: PageSnapshot
  actions: ProposedAction[]
  currentIdx: number
}) {
  const visible = snapshot.fields.filter((f) => f.visible)
  if (visible.length === 0) return null

  const actionsByAgentId = new Map(actions.map((a) => [a.action.agentId, a]))
  const processedSet = new Set(actions.slice(0, currentIdx).map((a) => a.action.agentId))

  return (
    <details className="border border-gray-200 rounded-lg overflow-hidden">
      <summary className="bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-500 cursor-pointer select-none">
        Fields ({visible.length})
      </summary>
      <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
        {visible.map((f) => {
          const proposed = actionsByAgentId.get(f.agentId)
          const done = processedSet.has(f.agentId)
          const isCurrent = proposed && actions[currentIdx]?.action.agentId === f.agentId

          return (
            <div key={f.agentId} className={`flex items-center gap-2 px-3 py-1.5 text-xs ${isCurrent ? 'bg-blue-50' : ''}`}>
              <KindBadge kind={f.kind} />
              <span className="flex-1 truncate">{f.label}</span>
              <StatusDot proposed={proposed} done={done} isCurrent={isCurrent ?? false} />
            </div>
          )
        })}
      </div>
    </details>
  )
}

function StatusDot({
  proposed, done, isCurrent,
}: {
  proposed?: ProposedAction
  done: boolean
  isCurrent: boolean
}) {
  if (done) return <span className="text-green-500 text-base">✓</span>
  if (isCurrent) return <span className="text-blue-500 text-base animate-pulse">●</span>
  if (!proposed) return <span className="text-gray-300 text-base">○</span>
  if (proposed.action.type === 'skip') return <span className="text-gray-300 text-base">–</span>
  return <span className="text-blue-300 text-base">○</span>
}

const KIND_COLORS: Record<string, string> = {
  text: 'bg-blue-100 text-blue-700',
  email: 'bg-purple-100 text-purple-700',
  tel: 'bg-indigo-100 text-indigo-700',
  select: 'bg-green-100 text-green-700',
  combobox: 'bg-teal-100 text-teal-700',
  radio_group: 'bg-amber-100 text-amber-700',
  checkbox: 'bg-orange-100 text-orange-700',
  checkbox_group: 'bg-orange-100 text-orange-700',
  textarea: 'bg-pink-100 text-pink-700',
  file: 'bg-gray-100 text-gray-700',
  date: 'bg-cyan-100 text-cyan-700',
}

function KindBadge({ kind }: { kind: string }) {
  const cls = KIND_COLORS[kind] ?? 'bg-gray-100 text-gray-600'
  const short = kind.replace('_group', '').slice(0, 6)
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${cls}`}>
      {short}
    </span>
  )
}

function Spinner({ small }: { small?: boolean }) {
  const size = small ? 'h-3 w-3' : 'h-6 w-6'
  return (
    <svg className={`animate-spin ${size} text-blue-500`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}
