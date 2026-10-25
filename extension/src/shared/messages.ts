import type { FrameSnapshot, PageSnapshot } from './types'

export type MessageKind =
  | 'PING' | 'PONG'
  | 'START_RUN'
  | 'EXTRACT_REQUEST'
  | 'EXTRACT_RESPONSE'
  | 'RUN_STATUS'
  | 'RUN_UPDATE'
  | 'STOP'
  | 'EXT_ERROR'

export interface StartRunMsg { kind: 'START_RUN'; tabId: number }
export interface ExtractRequestMsg { kind: 'EXTRACT_REQUEST'; frameId: number }
export interface ExtractResponseMsg { kind: 'EXTRACT_RESPONSE'; snapshot: FrameSnapshot }
export interface RunStatusMsg { kind: 'RUN_STATUS'; status: 'reading' | 'ready' | 'error'; message?: string }
export interface RunUpdateMsg { kind: 'RUN_UPDATE'; snapshot: PageSnapshot }
export interface StopMsg { kind: 'STOP' }
export interface ErrorMsg { kind: 'EXT_ERROR'; message: string }
export interface PingMsg { kind: 'PING' }
export interface PongMsg { kind: 'PONG' }

export type ExtensionMessage =
  | StartRunMsg | ExtractRequestMsg | ExtractResponseMsg
  | RunStatusMsg | RunUpdateMsg | StopMsg | ErrorMsg | PingMsg | PongMsg
