import type { PageSnapshot, Field } from '../../shared/types'

interface Props {
  status: 'idle' | 'reading' | 'ready' | 'error'
  snapshot: PageSnapshot | null
  serverConnected: boolean
  error?: string
  onActivate: () => void
}

export default function Run({ status, snapshot, serverConnected, error, onActivate }: Props) {
  if (status === 'reading') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
        <Spinner />
        <p>Reading page…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-red-500 text-sm">{error ?? 'Something went wrong'}</p>
        <button onClick={onActivate} className="text-xs text-blue-500 underline">Try again</button>
      </div>
    )
  }

  if (status === 'ready' && snapshot) {
    const visible = snapshot.fields.filter((f) => f.visible)
    const sections = groupBySection(visible)

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Found <strong>{visible.length}</strong> field{visible.length !== 1 ? 's' : ''}
            {snapshot.atsGuess && snapshot.atsGuess !== 'other'
              ? ` · ${snapshot.atsGuess}`
              : ''}
          </span>
          <button
            onClick={onActivate}
            className="text-xs text-blue-500 underline"
          >
            Re-read
          </button>
        </div>

        {snapshot.jobTitle && (
          <div className="text-xs text-gray-500">
            <strong>{snapshot.company ?? 'Company'}</strong>
            {snapshot.company ? ' — ' : ''}{snapshot.jobTitle}
          </div>
        )}

        {sections.map(([heading, fields]) => (
          <SectionBlock key={heading} heading={heading} fields={fields} />
        ))}

        {visible.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-4">No form fields detected on this page.</p>
        )}
      </div>
    )
  }

  // idle
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

function SectionBlock({ heading, fields }: { heading: string; fields: Field[] }) {
  return (
    <div className="space-y-1.5">
      {heading !== '__none__' && (
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 pt-2">
          {heading}
        </h3>
      )}
      {fields.map((f) => (
        <FieldRow key={f.agentId} field={f} />
      ))}
    </div>
  )
}

function FieldRow({ field }: { field: Field }) {
  return (
    <div className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
      <KindBadge kind={field.kind} />
      <span className="flex-1 text-sm truncate">{field.label}</span>
      {field.required && (
        <span className="text-red-400 text-xs font-semibold shrink-0">*</span>
      )}
    </div>
  )
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

function Spinner() {
  return (
    <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function groupBySection(fields: Field[]): [string, Field[]][] {
  const map = new Map<string, Field[]>()
  for (const f of fields) {
    const key = f.sectionHeading ?? '__none__'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(f)
  }
  return Array.from(map.entries())
}
