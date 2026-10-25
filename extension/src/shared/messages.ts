// Message contracts between background, content scripts and side panel.

export type MessageKind =
  | 'STOP'
  | 'ACTIVATE'
  | 'PING'
  | 'PONG'
  | 'RUN_STATE'

export interface ExtensionMessage {
  kind: MessageKind
  tabId?: number
  runId?: string
  payload?: unknown
}
