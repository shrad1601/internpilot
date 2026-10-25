import type { Action } from '../shared/types'

const SUBMIT_RE = /submit|apply\s+now|send\s+application|finish|complete\s+application/i

export interface FillResult {
  success: boolean
  actualValue?: string
  error?: string
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function executeAction(action: Action): Promise<FillResult> {
  // Hard-coded submit guard — always refuse, regardless of instructions
  if (action.type === 'click') {
    const el = findElement(action.agentId)
    if (el) {
      const text = el.textContent?.trim() || (el as HTMLInputElement).value || ''
      if (SUBMIT_RE.test(text)) {
        return { success: false, error: 'Refused: submit button — never clicked by agent' }
      }
      if (action.purpose === 'next' || action.purpose === 'add_entry' || action.purpose === 'expand') {
        return clickElement(el)
      }
    }
    return { success: false, error: `Element not found: ${action.agentId}` }
  }

  if (action.type === 'skip' || action.type === 'ask_user') {
    return { success: true }
  }

  const el = findElement(action.agentId)
  if (!el) return { success: false, error: `Element not found: ${action.agentId}` }

  await pulseOutline(el, 'amber')
  await scrollIntoView(el)

  let result: FillResult
  switch (action.type) {
    case 'fill':       result = await fillText(el, action.value); break
    case 'select':     result = fillSelect(el, action.optionLabel); break
    case 'choose_radio': result = fillRadio(action.agentId, action.optionLabel); break
    case 'check':      result = fillCheckbox(el, action.checked); break
    default:           result = { success: false, error: `Unknown action type` }
  }

  await pulseOutline(el, result.success ? 'green' : 'red')
  return result
}

// ── Finders ───────────────────────────────────────────────────────────────────

function findElement(agentId: string): Element | null {
  return document.querySelector(`[data-ip-id="${agentId}"]`)
}

// ── Scroll + visual feedback ──────────────────────────────────────────────────

function scrollIntoView(el: Element): Promise<void> {
  return new Promise((resolve) => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(resolve, 300)
  })
}

async function pulseOutline(el: Element, color: 'amber' | 'green' | 'red'): Promise<void> {
  const colors = { amber: '#f59e0b', green: '#22c55e', red: '#ef4444' }
  const prev = (el as HTMLElement).style.outline
  ;(el as HTMLElement).style.outline = `3px solid ${colors[color]}`
  ;(el as HTMLElement).style.outlineOffset = '2px'
  await new Promise((r) => setTimeout(r, 350))
  ;(el as HTMLElement).style.outline = prev
  ;(el as HTMLElement).style.outlineOffset = ''
}

// ── Fill: text / textarea / email / tel / url / number / date ────────────────

async function fillText(el: Element, value: string): Promise<FillResult> {
  const tag = el.tagName.toUpperCase()
  const isTextarea = tag === 'TEXTAREA'
  const isInput = tag === 'INPUT'

  if (!isInput && !isTextarea) {
    // contenteditable
    if (el.getAttribute('contenteditable') === 'true') {
      el.textContent = value
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return { success: true, actualValue: el.textContent ?? '' }
    }
    return { success: false, error: 'Not a text input' }
  }

  // Use native setter so React/Vue controlled inputs update properly
  const proto = isTextarea
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (nativeSetter) {
    nativeSetter.call(el, value)
  } else {
    (el as HTMLInputElement).value = value
  }

  ;(el as HTMLElement).focus()
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  ;(el as HTMLElement).blur()

  const actual = (el as HTMLInputElement).value
  if (actual !== value) {
    // One retry — some frameworks need a second nudge
    if (nativeSetter) nativeSetter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    const retry = (el as HTMLInputElement).value
    if (retry !== value) {
      return { success: false, actualValue: retry, error: `Value mismatch: got "${retry}"` }
    }
  }

  return { success: true, actualValue: (el as HTMLInputElement).value }
}

// ── Fill: native <select> ─────────────────────────────────────────────────────

function fillSelect(el: Element, optionLabel: string): FillResult {
  if (el.tagName.toUpperCase() !== 'SELECT') {
    return { success: false, error: 'Not a select element' }
  }
  const sel = el as HTMLSelectElement
  const target = optionLabel.toLowerCase()

  // Exact match, then partial
  let matched: HTMLOptionElement | undefined
  for (const opt of Array.from(sel.options)) {
    if (opt.text.trim().toLowerCase() === target) { matched = opt; break }
  }
  if (!matched) {
    for (const opt of Array.from(sel.options)) {
      if (opt.text.trim().toLowerCase().includes(target) || target.includes(opt.text.trim().toLowerCase())) {
        matched = opt; break
      }
    }
  }
  if (!matched) {
    return { success: false, error: `Option not found: "${optionLabel}"` }
  }

  sel.value = matched.value
  sel.dispatchEvent(new Event('change', { bubbles: true }))

  return { success: true, actualValue: matched.text.trim() }
}

// ── Fill: radio group ─────────────────────────────────────────────────────────

function fillRadio(groupAgentId: string, optionLabel: string): FillResult {
  // The agentId is on the first radio in the group — find all radios with same name
  const first = findElement(groupAgentId) as HTMLInputElement | null
  if (!first) return { success: false, error: `Radio group not found: ${groupAgentId}` }

  const name = first.getAttribute('name')
  const radios = name
    ? Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`))
    : [first]

  const target = optionLabel.toLowerCase()
  let matched: HTMLInputElement | undefined

  for (const radio of radios) {
    // Check value and label
    const lbl = _radioLabel(radio)
    if (lbl.toLowerCase() === target || radio.value.toLowerCase() === target) {
      matched = radio; break
    }
  }
  if (!matched) {
    for (const radio of radios) {
      const lbl = _radioLabel(radio)
      if (lbl.toLowerCase().includes(target) || target.includes(lbl.toLowerCase())) {
        matched = radio; break
      }
    }
  }
  if (!matched) return { success: false, error: `Radio option not found: "${optionLabel}"` }

  ;(matched as HTMLElement).click()
  matched.dispatchEvent(new Event('change', { bubbles: true }))

  return { success: true, actualValue: matched.value }
}

function _radioLabel(radio: HTMLInputElement): string {
  const id = radio.getAttribute('id')
  if (id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`)
    if (lbl) return lbl.textContent?.trim() ?? ''
  }
  const wrap = radio.closest('label')
  if (wrap) {
    const clone = wrap.cloneNode(true) as Element
    clone.querySelectorAll('input').forEach((c) => c.remove())
    return clone.textContent?.trim() ?? ''
  }
  return radio.value
}

// ── Fill: checkbox ────────────────────────────────────────────────────────────

function fillCheckbox(el: Element, checked: boolean): FillResult {
  const input = el as HTMLInputElement
  if (input.checked !== checked) {
    ;(input as HTMLElement).click()
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }
  return { success: true, actualValue: String(input.checked) }
}

// ── Click ─────────────────────────────────────────────────────────────────────

function clickElement(el: Element): FillResult {
  // Final submit guard at execution time
  const text = el.textContent?.trim() || (el as HTMLInputElement).value || ''
  if (SUBMIT_RE.test(text)) {
    return { success: false, error: 'Refused: submit button — never clicked by agent' }
  }
  ;(el as HTMLElement).click()
  return { success: true }
}
