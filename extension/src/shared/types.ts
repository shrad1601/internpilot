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

export type RunStatus = 'idle' | 'reading' | 'ready' | 'error'

// Server schemas
export interface HealthResponse { status: string; version: string }
export interface PairRequest { code: string }
export interface PairResponse { token: string }
