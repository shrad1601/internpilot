import type { Field } from '../shared/types'

const HOST_ID = 'internpilot-overlay'

const COLORS: Record<string, string> = {
  proposed: '#3b82f6',  // blue
  filled:   '#22c55e',  // green
  waiting:  '#f59e0b',  // amber
  skip:     '#6b7280',  // grey
  blocked:  '#ef4444',  // red
}

function host(): HTMLElement | null {
  return document.getElementById(HOST_ID)
}

export function initOverlay(): void {
  removeOverlay()
  const el = document.createElement('div')
  el.id = HOST_ID
  el.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'width:0', 'height:0',
    `z-index:${(2 ** 31) - 1}`, 'pointer-events:none',
  ].join(';')
  document.documentElement.appendChild(el)
  const sr = el.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = '* { box-sizing: border-box; font-family: system-ui, sans-serif; }'
  sr.appendChild(style)
}

export function removeOverlay(): void {
  host()?.remove()
}

function shadowRoot(): ShadowRoot | null {
  return host()?.shadowRoot ?? null
}

export function clearOutlines(): void {
  shadowRoot()?.querySelectorAll('.ip-outline,.ip-tag').forEach((n) => n.remove())
}

export function renderFieldOutlines(fields: Field[], color = 'proposed'): void {
  const sr = shadowRoot()
  if (!sr) return
  clearOutlines()

  const borderColor = COLORS[color] ?? COLORS.proposed

  for (const field of fields) {
    if (!field.visible) continue
    const el = document.querySelector(`[data-ip-id="${field.agentId}"]`)
    if (!el) continue

    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue

    const outline = document.createElement('div')
    outline.className = 'ip-outline'
    outline.style.cssText = [
      'position:fixed', `top:${rect.top - 2}px`, `left:${rect.left - 2}px`,
      `width:${rect.width + 4}px`, `height:${rect.height + 4}px`,
      `border:2px solid ${borderColor}`, 'border-radius:4px',
      'pointer-events:none', 'transition:border-color .2s',
    ].join(';')
    sr.appendChild(outline)

    const tag = document.createElement('div')
    tag.className = 'ip-tag'
    tag.style.cssText = [
      'position:fixed',
      `top:${Math.max(0, rect.top - 22)}px`,
      `left:${rect.left}px`,
      `background:${borderColor}`, 'color:#fff',
      'font-size:11px', 'padding:1px 6px',
      'border-radius:3px 3px 3px 0', 'pointer-events:none',
      'white-space:nowrap', 'max-width:220px',
      'overflow:hidden', 'text-overflow:ellipsis',
    ].join(';')
    tag.textContent = field.label
    sr.appendChild(tag)
  }
}

// Floating status bar shown during a run
let barEl: HTMLElement | null = null

export function showStatusBar(text: string, onStop: () => void): void {
  const sr = shadowRoot()
  if (!sr) return

  barEl?.remove()
  const bar = document.createElement('div')
  bar.id = 'ip-bar'
  bar.style.cssText = [
    'position:fixed', 'top:12px', 'left:50%', 'transform:translateX(-50%)',
    'background:#1e40af', 'color:#fff', 'font-size:13px',
    'padding:6px 14px', 'border-radius:20px',
    'display:flex', 'align-items:center', 'gap:10px',
    'pointer-events:auto', 'z-index:1', 'box-shadow:0 2px 8px rgba(0,0,0,.3)',
  ].join(';')

  const label = document.createElement('span')
  label.textContent = text

  const stopBtn = document.createElement('button')
  stopBtn.textContent = 'STOP'
  stopBtn.style.cssText = [
    'background:#ef4444', 'border:none', 'color:#fff',
    'padding:2px 8px', 'border-radius:10px', 'cursor:pointer',
    'font-size:11px', 'font-weight:700',
  ].join(';')
  stopBtn.addEventListener('click', onStop)

  bar.appendChild(label)
  bar.appendChild(stopBtn)
  sr.appendChild(bar)
  barEl = bar
}

export function removeStatusBar(): void {
  barEl?.remove()
  barEl = null
}

// Per-field status colors during a fill run

export function updateFieldStatus(agentId: string, status: 'proposed' | 'waiting' | 'filled' | 'blocked' | 'skip'): void {
  const sr = shadowRoot()
  if (!sr) return

  const color = COLORS[status] ?? COLORS.proposed

  // Find or create a dedicated status outline for this field
  let outline = sr.querySelector<HTMLElement>(`[data-ip-status="${agentId}"]`)
  if (!outline) {
    const el = document.querySelector(`[data-ip-id="${agentId}"]`)
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return

    outline = document.createElement('div')
    outline.setAttribute('data-ip-status', agentId)
    outline.style.cssText = [
      'position:fixed', `top:${rect.top - 3}px`, `left:${rect.left - 3}px`,
      `width:${rect.width + 6}px`, `height:${rect.height + 6}px`,
      'border-radius:5px', 'pointer-events:none',
      'transition:border-color .2s, box-shadow .2s',
    ].join(';')
    sr.appendChild(outline)
  }

  outline.style.border = `2px solid ${color}`
  outline.style.boxShadow = `0 0 0 1px ${color}40`
}
