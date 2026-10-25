// Shared types — mirrored from server schemas.

export interface HealthResponse {
  status: string
  version: string
}

export interface PairRequest {
  code: string
}

export interface PairResponse {
  token: string
}

export type FieldKind =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'date'
  | 'textarea'
  | 'select'
  | 'combobox'
  | 'radio_group'
  | 'checkbox'
  | 'checkbox_group'
  | 'file'
  | 'password'
  | 'unknown'
