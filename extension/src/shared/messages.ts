import type { PageSnapshot, FrameSnapshot, ProposedAction, StepEntry, RunStatus, Action } from './types'

// ── Panel ↔ Service worker ────────────────────────────────────────────────────

interface PingMsg { kind: 'PING' }
interface PongMsg { kind: 'PONG' }

interface StartRunMsg { kind: 'START_RUN'; tabId: number }
interface StopMsg { kind: 'STOP' }

// Panel approves a single action in the queue
interface ApproveActionMsg { kind: 'APPROVE_ACTION'; idx: number }
// Panel skips (rejects) a single action
interface RejectActionMsg { kind: 'REJECT_ACTION'; idx: number }
// Panel submits an answer to an ask_user
interface AnswerQuestionMsg { kind: 'ANSWER_QUESTION'; idx: number; value: string; remember: boolean }

// ── Service worker → panel ────────────────────────────────────────────────────

interface RunStatusMsg {
  kind: 'RUN_STATUS'
  status: RunStatus
  message?: string
}

interface RunUpdateMsg {
  kind: 'RUN_UPDATE'
  snapshot: PageSnapshot
}

interface PlanReadyMsg {
  kind: 'PLAN_READY'
  runId: string
  actions: ProposedAction[]
}

interface StepLoggedMsg {
  kind: 'STEP_LOGGED'
  entry: StepEntry
}

interface ActionFilledMsg {
  kind: 'ACTION_FILLED'
  idx: number
  success: boolean
  error?: string
}

// ── Service worker ↔ content script ──────────────────────────────────────────

interface ExtractRequestMsg { kind: 'EXTRACT_REQUEST'; frameId: number }
interface ExtractResponseMsg { kind: 'EXTRACT_RESPONSE'; snapshot: FrameSnapshot }

interface FillActionMsg {
  kind: 'FILL_ACTION'
  action: Action
  runId: string
  idx: number
}

interface FillResultMsg {
  kind: 'FILL_RESULT'
  idx: number
  success: boolean
  actualValue?: string
  error?: string
}

interface ExtErrorMsg { kind: 'EXT_ERROR'; message: string }

// ── Union ─────────────────────────────────────────────────────────────────────

export type ExtensionMessage =
  | PingMsg | PongMsg
  | StartRunMsg | StopMsg
  | ApproveActionMsg | RejectActionMsg | AnswerQuestionMsg
  | RunStatusMsg | RunUpdateMsg | PlanReadyMsg | StepLoggedMsg | ActionFilledMsg
  | ExtractRequestMsg | ExtractResponseMsg
  | FillActionMsg | FillResultMsg
  | ExtErrorMsg
