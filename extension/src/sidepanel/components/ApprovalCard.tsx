import { useState } from 'react'
import type { ProposedAction } from '../../shared/types'

interface Props {
  idx: number
  proposed: ProposedAction
  fieldLabel?: string
  onApprove: (idx: number, editedValue?: string) => void
  onReject: (idx: number) => void
  onAnswer: (idx: number, value: string, remember: boolean) => void
}

const SOURCE_LABELS: Record<string, string> = {
  profile: 'profile',
  rule: 'rule',
  memory: 'memory',
  llm: 'AI',
  research: 'research',
  user: 'you',
}

const SENSITIVITY_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
}

export default function ApprovalCard({ idx, proposed, fieldLabel, onApprove, onReject, onAnswer }: Props) {
  const { action, source, confidence, sensitivity } = proposed
  const [editedValue, setEditedValue] = useState<string>('')
  const [answered, setAnswered] = useState('')
  const [remember, setRemember] = useState(false)

  if (action.type === 'ask_user') {
    return (
      <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-amber-500 text-base">?</span>
          <span className="text-xs font-semibold text-amber-800">Question</span>
        </div>
        <p className="text-sm text-gray-800">{action.question}</p>
        {action.reason && (
          <p className="text-xs text-gray-500 italic">{action.reason}</p>
        )}
        {action.suggestions && action.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {action.suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setAnswered(s)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                  answered === s
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <input
          type="text"
          value={answered}
          onChange={(e) => setAnswered(e.target.value)}
          placeholder="Your answer…"
          className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-3 h-3" />
            Remember
          </label>
          <div className="flex-1" />
          <button
            onClick={() => onReject(idx)}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
          >
            Skip
          </button>
          <button
            onClick={() => answered.trim() && onAnswer(idx, answered.trim(), remember)}
            disabled={!answered.trim()}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-40 hover:bg-blue-700"
          >
            Submit
          </button>
        </div>
      </div>
    )
  }

  if (action.type === 'skip') {
    return (
      <div className="border border-gray-200 rounded-lg p-3 flex items-center gap-3 bg-gray-50">
        <span className="text-gray-400 text-base">⏭</span>
        <div className="flex-1 min-w-0">
          {fieldLabel && <p className="text-xs font-medium text-gray-700 truncate">{fieldLabel}</p>}
          <p className="text-xs text-gray-500 truncate">
            Skip: {action.reason}
          </p>
        </div>
        <button
          onClick={() => onApprove(idx)}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          OK
        </button>
      </div>
    )
  }

  // Fill / select / radio / check actions
  const fieldValue = (() => {
    if (action.type === 'fill') return action.value
    if (action.type === 'select') return action.optionLabel
    if (action.type === 'choose_radio') return action.optionLabel
    if (action.type === 'check') return action.checked ? 'check' : 'uncheck'
    return ''
  })()

  const isEditable = action.type === 'fill' || action.type === 'select'
  const displayValue = editedValue || fieldValue

  const isSensitive = sensitivity === 'high'

  return (
    <div className={`border rounded-lg p-3 space-y-2 ${isSensitive ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
      {isSensitive && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 font-semibold">
          <span>⚠️</span> Sensitive field — review carefully
        </div>
      )}
      {fieldLabel && <p className="text-sm font-medium text-gray-900" data-testid="field-label">{fieldLabel}</p>}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-gray-700">
              {_actionLabel(action.type)}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SENSITIVITY_COLORS[sensitivity]}`}>
              {sensitivity}
            </span>
            <span className="text-[10px] text-gray-400">
              {SOURCE_LABELS[source] ?? source} · {Math.round(confidence * 100)}%
            </span>
          </div>
        </div>
      </div>

      {isEditable ? (
        <input
          type="text"
          value={displayValue}
          onChange={(e) => setEditedValue(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
        />
      ) : (
        <div className="text-sm bg-white rounded px-2 py-1 border border-gray-200 font-mono truncate">
          {fieldValue}
        </div>
      )}

      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={() => onReject(idx)}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
        >
          Skip
        </button>
        <button
          onClick={() => onApprove(idx, isEditable && editedValue ? editedValue : undefined)}
          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
        >
          Fill
        </button>
      </div>
    </div>
  )
}

function _actionLabel(type: string): string {
  switch (type) {
    case 'fill': return 'Fill text'
    case 'select': return 'Select option'
    case 'choose_radio': return 'Choose radio'
    case 'check': return 'Checkbox'
    default: return type
  }
}
