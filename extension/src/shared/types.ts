export type FieldKind =
  | 'text' | 'email' | 'tel' | 'url' | 'number' | 'date' | 'textarea'
  | 'select' | 'combobox' | 'radio_group' | 'checkbox' | 'checkbox_group'
  | 'file' | 'password' | 'unknown'

export type ATSKind =
  | 'greenhouse' | 'lever' | 'workday' | 'successfactors'
  | 'taleo' | 'icims' | 'ashby' | 'other'

export interface FieldOption {
  value: string
  label: string
}

export interface Field {
  agentId: string
  frameId: number
  kind: FieldKind
  label: string
  labelSources: string[]
  name?: string
  id?: string
  placeholder?: string
  ariaLabel?: string
  helpText?: string
  sectionHeading?: string
  required: boolean
  currentValue?: string | string[]
  options?: FieldOption[]
  maxLength?: number
  accept?: string
  visible: boolean
  disabled: boolean
}

export interface PageButton {
  agentId: string
  text: string
  role: 'next' | 'back' | 'submit' | 'save' | 'other'
}

export interface FrameSnapshot {
  frameId: number
  url: string
  title: string
  atsGuess: ATSKind
  jobTitle?: string
  company?: string
  fields: Field[]
  buttons: PageButton[]
}

export interface PageSnapshot {
  url: string
  domain: string
  title: string
  atsGuess?: ATSKind
  jobTitle?: string
  company?: string
  jobDescription?: string
  fields: Field[]
  buttons: PageButton[]
  stepIndicator?: string
}

export type RunStatus = 'idle' | 'reading' | 'planning' | 'awaiting_approval' | 'filling' | 'stopped' | 'error' | 'done'

// ── Actions ───────────────────────────────────────────────────────────────────

export type Action =
  | { type: 'fill'; agentId: string; value: string }
  | { type: 'select'; agentId: string; optionLabel: string }
  | { type: 'check'; agentId: string; checked: boolean }
  | { type: 'choose_radio'; agentId: string; optionLabel: string }
  | { type: 'upload'; agentId: string; documentKey: string }
  | { type: 'click'; agentId: string; purpose: 'next' | 'add_entry' | 'expand' }
  | { type: 'ask_user'; agentId: string; question: string; reason: string; suggestions?: string[] }
  | { type: 'skip'; agentId: string; reason: string }

export interface ProposedAction {
  action: Action
  source: 'rule' | 'memory' | 'profile' | 'llm' | 'research' | 'user'
  confidence: number
  sensitivity: 'low' | 'medium' | 'high'
  explanation: string
  memoryRefs?: string[]
}

// ── Step log ──────────────────────────────────────────────────────────────────

export type StepKind =
  | 'read_page' | 'propose' | 'approve' | 'edit' | 'skip'
  | 'fill' | 'click' | 'ask' | 'answer' | 'navigate'
  | 'error' | 'stop' | 'feedback'

export type StepStatus = 'ok' | 'waiting' | 'skipped' | 'failed'

export interface StepEntry {
  seq: number
  ts: string
  kind: StepKind
  status: StepStatus
  fieldLabel?: string
  agentId?: string
  value?: string
  source?: string
  confidence?: number
  message: string
  durationMs?: number
}

// ── Server schemas ────────────────────────────────────────────────────────────

export interface HealthResponse { status: string; version: string }
export interface PairRequest { code: string }
export interface PairResponse { token: string }
export interface RunCreateRequest { tabId: number; url: string; title?: string; company?: string; jobTitle?: string }
export interface RunResponse { runId: string }
export interface PlanResponse { runId: string; actions: ProposedAction[] }
