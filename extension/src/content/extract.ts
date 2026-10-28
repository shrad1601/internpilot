import type { Field, FieldKind, FieldOption, PageButton, FrameSnapshot, ATSKind } from '../shared/types'

const IP_ID_ATTR = 'data-ip-id'
// Per-instance prefix so a re-injected script never reuses ids stamped by a stale one.
const ID_PREFIX = Math.random().toString(36).slice(2, 7)
let _idCounter = 0

export function resetIdCounter() { _idCounter = 0 }

// ── Stamping ──────────────────────────────────────────────────────────────────

function getOrStamp(el: Element): string {
  const existing = el.getAttribute(IP_ID_ATTR)
  if (existing?.startsWith(`ip-${ID_PREFIX}-`)) return existing
  const id = `ip-${ID_PREFIX}-${_idCounter++}`
  el.setAttribute(IP_ID_ATTR, id)
  return id
}

// ── Deep element collection (pierces shadow roots) ───────────────────────────

function allElementsDeep(root: Document | ShadowRoot | Element): Element[] {
  const results: Element[] = []
  function walk(node: Document | ShadowRoot | Element) {
    const children = node.querySelectorAll('*')
    children.forEach((child) => {
      results.push(child)
      if ((child as Element).shadowRoot) walk((child as Element).shadowRoot!)
    })
  }
  walk(root)
  return results
}

// ── Visibility ────────────────────────────────────────────────────────────────

function hasHiddenInlineStyle(e: Element): boolean {
  const s = e.getAttribute('style') ?? ''
  return /display\s*:\s*none/i.test(s) || /visibility\s*:\s*hidden/i.test(s)
}

function isHidden(el: Element): boolean {
  // Use tagName/getAttribute instead of instanceof to work across JSDOM instances
  if (el.tagName.toUpperCase() === 'INPUT' &&
      (el.getAttribute('type') ?? 'text').toLowerCase() === 'hidden') return true
  if (el.hasAttribute('hidden')) return true

  if (hasHiddenInlineStyle(el)) return true

  // Computed style (works in real browser; may be incomplete in jsdom)
  try {
    const cs = (el.ownerDocument.defaultView ?? window).getComputedStyle(el)
    if (cs.display === 'none') return true
    if (cs.visibility === 'hidden') return true
  } catch { /* ignore */ }

  if (el.getAttribute('aria-hidden') === 'true') return true

  // Walk ancestors for aria-hidden and inline display:none
  let parent = el.parentElement
  while (parent) {
    if (parent.getAttribute('aria-hidden') === 'true') return true
    if (hasHiddenInlineStyle(parent)) return true
    parent = parent.parentElement
  }
  return false
}

// ── Candidate detection ───────────────────────────────────────────────────────

const BLOCKED_INPUT_TYPES = new Set(['submit', 'button', 'reset', 'image'])

const CAPTCHA_RE = /recaptcha|hcaptcha|h-captcha|cf-turnstile|captcha/i

function isCandidate(el: Element): boolean {
  const tag = el.tagName.toUpperCase()
  const ident = `${el.getAttribute('name') ?? ''} ${el.getAttribute('id') ?? ''} ${el.getAttribute('class') ?? ''}`
  if (CAPTCHA_RE.test(ident)) return false
  const role = el.getAttribute('role')
  const ce = el.getAttribute('contenteditable')

  if (tag === 'INPUT') {
    const type = ((el as HTMLInputElement).type ?? 'text').toLowerCase()
    if (BLOCKED_INPUT_TYPES.has(type)) return false
    return true
  }
  if (tag === 'SELECT' || tag === 'TEXTAREA') return true
  if (ce === 'true') return true
  // ARIA wrappers around native inputs are represented by those inputs.
  if ((role === 'radiogroup' || role === 'listbox') && el.querySelector('input, select')) return false
  if (role === 'combobox' || role === 'listbox' || role === 'radiogroup' ||
      role === 'checkbox' || role === 'switch') return true
  return false
}

// ── Label resolution ──────────────────────────────────────────────────────────

function cleanLabel(text: string): string {
  return text
    .replace(/\*/g, '')
    .replace(/\(optional\)/gi, '')
    .replace(/\boptional\b/gi, '')
    .replace(/\bplease\s+enter\b/gi, '')
    .replace(/\brequired\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function humanize(str: string): string {
  return str
    .replace(/[-_.]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function nearbyText(el: Element): string {
  // Check previous siblings for a text-like element
  let sib = el.previousElementSibling
  while (sib) {
    if (!isCandidate(sib)) {
      const t = cleanLabel(sib.textContent ?? '')
      if (t) return t
    }
    sib = sib.previousElementSibling
  }

  // Direct text nodes in parent
  const parent = el.parentElement
  if (!parent) return ''
  const texts: string[] = []
  parent.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = cleanLabel(n.textContent ?? '')
      if (t) texts.push(t)
    }
  })
  if (texts.length) return texts[texts.length - 1]

  // Previous sibling of parent (table cell pattern)
  const prevCell = parent.previousElementSibling
  if (prevCell && !isCandidate(prevCell)) {
    const t = cleanLabel(prevCell.textContent ?? '')
    if (t) return t
  }

  return ''
}

function resolveLabel(el: Element, doc: Document): { label: string; sources: string[] } {
  // 1. <label for="id">
  const id = el.getAttribute('id')
  if (id) {
    try {
      const lbl = doc.querySelector(`label[for="${CSS.escape(id)}"]`)
      if (lbl) {
        const t = cleanLabel(lbl.textContent ?? '')
        if (t) return { label: t, sources: ['label-for'] }
      }
    } catch { /* CSS.escape may not be available in jsdom */ }
    const lbl = doc.querySelector(`label[for="${id}"]`)
    if (lbl) {
      const t = cleanLabel(lbl.textContent ?? '')
      if (t) return { label: t, sources: ['label-for'] }
    }
  }

  // 2. Wrapping <label>
  const wrapLabel = el.closest('label')
  if (wrapLabel) {
    const clone = wrapLabel.cloneNode(true) as Element
    clone.querySelectorAll('input,select,textarea,button').forEach((c) => c.remove())
    const t = cleanLabel(clone.textContent ?? '')
    if (t) return { label: t, sources: ['label-wrap'] }
  }

  // 3. aria-labelledby
  const lby = el.getAttribute('aria-labelledby')
  if (lby) {
    const t = cleanLabel(
      lby.split(/\s+/)
        .map((refId) => doc.getElementById(refId)?.textContent ?? '')
        .join(' '),
    )
    if (t) return { label: t, sources: ['aria-labelledby'] }
  }

  // 4. aria-label
  const al = el.getAttribute('aria-label')
  if (al) {
    const t = cleanLabel(al)
    if (t) return { label: t, sources: ['aria-label'] }
  }

  // 5. fieldset > legend
  const fs = el.closest('fieldset')
  if (fs) {
    const legend = fs.querySelector('legend')
    if (legend) {
      const t = cleanLabel(legend.textContent ?? '')
      if (t) return { label: t, sources: ['legend'] }
    }
  }

  // 6. Nearby text (preceding sibling / parent text node / table cell)
  const nb = nearbyText(el)
  if (nb) return { label: nb, sources: ['nearby-text'] }

  // 7. placeholder
  const ph = el.getAttribute('placeholder')
  if (ph) {
    const t = cleanLabel(ph)
    if (t) return { label: t, sources: ['placeholder'] }
  }

  // 8. name / id humanised
  const raw = el.getAttribute('name') || el.getAttribute('id') || ''
  if (raw) {
    const t = humanize(raw)
    if (t) return { label: t, sources: ['name'] }
  }

  return { label: 'Unknown field', sources: ['none'] }
}

// ── Section heading ───────────────────────────────────────────────────────────

function sectionHeading(el: Element): string | undefined {
  let node: Element | null = el
  while (node) {
    let prev: Element | null = node.previousElementSibling
    while (prev) {
      if (/^H[1-4]$/i.test(prev.tagName) || prev.getAttribute('role') === 'heading') {
        const t = prev.textContent?.trim()
        if (t) return t
      }
      prev = prev.previousElementSibling
    }
    node = node.parentElement
  }
  return undefined
}

// ── Help text ─────────────────────────────────────────────────────────────────

function helpText(el: Element, doc: Document): string | undefined {
  const desc = el.getAttribute('aria-describedby')
  if (desc) {
    const t = desc.split(/\s+/)
      .map((id) => doc.getElementById(id)?.textContent?.trim() ?? '')
      .join(' ')
      .trim()
    if (t) return t
  }
  // Next sibling small/span that looks like hint text
  const next = el.nextElementSibling
  if (next && /^(SMALL|SPAN|P|DIV)$/.test(next.tagName)) {
    const t = next.textContent?.trim()
    if (t && t.length < 200) return t
  }
  return undefined
}

// ── Required ──────────────────────────────────────────────────────────────────

function isRequired(el: Element): boolean {
  if (el.hasAttribute('required')) return true
  if (el.getAttribute('aria-required') === 'true') return true
  // Asterisk in label
  const id = el.getAttribute('id')
  if (id) {
    const lbl = el.ownerDocument.querySelector(`label[for="${id}"]`)
    if (lbl?.textContent?.includes('*')) return true
  }
  const wl = el.closest('label')
  if (wl?.textContent?.includes('*')) return true
  return false
}

// ── Field kind ────────────────────────────────────────────────────────────────

function fieldKind(el: Element): FieldKind {
  const tag = el.tagName.toUpperCase()
  const role = el.getAttribute('role')

  if (tag === 'SELECT') return 'select'
  if (tag === 'TEXTAREA') return 'textarea'

  if (tag === 'INPUT') {
    const type = ((el as HTMLInputElement).type ?? 'text').toLowerCase()
    const map: Record<string, FieldKind> = {
      password: 'password', file: 'file', checkbox: 'checkbox',
      radio: 'radio_group', email: 'email', tel: 'tel',
      url: 'url', number: 'number', date: 'date',
    }
    return map[type] ?? 'text'
  }

  if (role === 'combobox' || el.getAttribute('aria-haspopup') === 'listbox') return 'combobox'
  if (role === 'radiogroup') return 'radio_group'
  if (role === 'checkbox' || role === 'switch') return 'checkbox'
  if (el.getAttribute('contenteditable') === 'true') return 'textarea'
  return 'unknown'
}

// ── Select options ────────────────────────────────────────────────────────────

function selectOptions(el: HTMLSelectElement): FieldOption[] {
  return Array.from(el.options)
    .filter((o) => o.value !== '' && o.text.trim() !== '')
    .map((o) => ({ value: o.value, label: o.text.trim() }))
}

// ── Button classification ─────────────────────────────────────────────────────

const NEXT_RE = /next|continue|proceed|save\s+and\s+continue/i
const BACK_RE = /back|previous|prev/i
const SUBMIT_RE = /submit|apply|send\s+application|finish|complete/i
const SAVE_RE = /save\s+draft|save\s+progress/i

function buttonRole(text: string): PageButton['role'] {
  if (SUBMIT_RE.test(text)) return 'submit'
  if (NEXT_RE.test(text)) return 'next'
  if (BACK_RE.test(text)) return 'back'
  if (SAVE_RE.test(text)) return 'save'
  return 'other'
}

function extractButtons(doc: Document): PageButton[] {
  const sel = 'button, input[type="submit"], input[type="button"], [role="button"], a[role="button"]'
  return Array.from(doc.querySelectorAll(sel))
    .map((el) => {
      const text =
        (el as HTMLInputElement).value ||
        el.textContent?.trim() ||
        el.getAttribute('aria-label') ||
        ''
      return {
        agentId: getOrStamp(el),
        text: text.trim(),
        role: buttonRole(text),
      }
    })
    .filter((b) => b.text.length > 0)
}

// ── Radio grouping ────────────────────────────────────────────────────────────

function radioOptionLabel(radio: HTMLInputElement, doc: Document): string {
  const id = radio.getAttribute('id')
  if (id) {
    const lbl = doc.querySelector(`label[for="${id}"]`)
    if (lbl) return cleanLabel(lbl.textContent ?? '')
  }
  const wl = radio.closest('label')
  if (wl) {
    const clone = wl.cloneNode(true) as Element
    clone.querySelectorAll('input').forEach((c) => c.remove())
    return cleanLabel(clone.textContent ?? '')
  }
  return radio.value
}

function commonContainer(els: Element[]): Element | null {
  let node = els[0].parentElement
  while (node && !els.every((e) => node!.contains(e))) node = node.parentElement
  return node
}

// The question a radio group answers: its own label, not an enclosing section's legend.
function radioQuestionLabel(radios: HTMLInputElement[], doc: Document): { label: string; sources: string[] } {
  const container = commonContainer(radios)
  if (!container) return { label: '', sources: [] }

  const group = radios[0].closest('[role="radiogroup"]')
  if (group) {
    const lby = group.getAttribute('aria-labelledby')
    const t = lby
      ? cleanLabel(lby.split(/\s+/).map((id) => doc.getElementById(id)?.textContent ?? '').join(' '))
      : cleanLabel(group.getAttribute('aria-label') ?? '')
    if (t) return { label: t, sources: [lby ? 'aria-labelledby' : 'aria-label'] }
  }

  // A fieldset that holds only this group: its legend is the question.
  const fs = radios[0].closest('fieldset')
  if (fs) {
    const controlsInFs = fs.querySelectorAll('input, select, textarea').length
    const legend = fs.querySelector(':scope > legend')
    if (legend && controlsInFs === radios.length) {
      const t = cleanLabel(legend.textContent ?? '')
      if (t) return { label: t, sources: ['legend'] }
    }
  }

  // Text that precedes the options inside their shared container.
  const firstOptionChild = Array.from(container.children).find((c) => radios.some((r) => c.contains(r)))
  let prev = firstOptionChild?.previousElementSibling ?? null
  while (prev) {
    if (!prev.querySelector('input, select, textarea')) {
      const t = cleanLabel(prev.textContent ?? '')
      if (t) return { label: t, sources: ['question-text'] }
    }
    prev = prev.previousElementSibling
  }
  const before = container.previousElementSibling
  if (before && !before.querySelector('input, select, textarea') && !/^LEGEND$/i.test(before.tagName)) {
    const t = cleanLabel(before.textContent ?? '')
    if (t) return { label: t, sources: ['question-text'] }
  }

  // Last resort: an enclosing section legend.
  const outerLegend = fs?.querySelector(':scope > legend')
  const t = cleanLabel(outerLegend?.textContent ?? '')
  return t ? { label: t, sources: ['legend'] } : { label: '', sources: [] }
}

function groupRadios(
  radios: HTMLInputElement[],
  frameId: number,
  doc: Document,
): Field {
  const first = radios[0]
  let { label, sources: labelSources } = radioQuestionLabel(radios, doc)
  if (!label) {
    const resolved = resolveLabel(first, doc)
    label = resolved.label
    labelSources = resolved.sources
  }

  const options = radios.map((r) => ({
    value: r.value,
    label: radioOptionLabel(r, doc),
  }))
  const checked = radios.find((r) => r.checked)

  return {
    agentId: getOrStamp(first),
    frameId,
    kind: 'radio_group',
    label,
    labelSources,
    name: first.name || undefined,
    required: radios.some((r) => r.hasAttribute('required') || r.getAttribute('aria-required') === 'true'),
    currentValue: checked?.value,
    options,
    visible: !isHidden(first),
    disabled: radios.every((r) => r.disabled),
    sectionHeading: sectionHeading(first),
    helpText: helpText(first, doc),
  }
}

// ── Checkbox grouping ─────────────────────────────────────────────────────────

function groupCheckboxes(
  boxes: HTMLInputElement[],
  frameId: number,
  doc: Document,
): Field {
  const first = boxes[0]
  const fs = first.closest('fieldset')
  let label = ''
  let labelSources: string[] = []
  if (fs) {
    const legend = fs.querySelector('legend')
    if (legend) {
      label = cleanLabel(legend.textContent ?? '')
      labelSources = ['legend']
    }
  }
  if (!label) {
    const r = resolveLabel(first, doc)
    label = r.label
    labelSources = r.sources
  }

  const options = boxes.map((b) => ({ value: b.value, label: radioOptionLabel(b, doc) }))
  const checked = boxes.filter((b) => b.checked).map((b) => b.value)

  return {
    agentId: getOrStamp(first),
    frameId,
    kind: 'checkbox_group',
    label,
    labelSources,
    name: first.name || undefined,
    required: boxes.some((b) => b.hasAttribute('required')),
    currentValue: checked.length ? checked : undefined,
    options,
    visible: !isHidden(first),
    disabled: boxes.every((b) => b.disabled),
    sectionHeading: sectionHeading(first),
  }
}

// ── ATS detection ─────────────────────────────────────────────────────────────

function guessATS(url: string, doc: Document): ATSKind {
  try {
    const host = new URL(url).hostname
    if (/greenhouse\.io/.test(host)) return 'greenhouse'
    if (/lever\.co/.test(host)) return 'lever'
    if (/myworkdayjobs\.com|workday\.com/.test(host)) return 'workday'
    if (/successfactors/.test(host)) return 'successfactors'
    if (/taleo\.net/.test(host)) return 'taleo'
    if (/icims\.com/.test(host)) return 'icims'
    if (/ashbyhq\.com/.test(host)) return 'ashby'
  } catch { /* local/test URLs */ }

  // DOM-based clues
  if (doc.querySelector('[data-automation-id]')) return 'workday'
  if (doc.querySelector('[data-greenhouse-jobboard]')) return 'greenhouse'

  return 'other'
}

// ── Job info ──────────────────────────────────────────────────────────────────

function jobInfo(doc: Document): { jobTitle?: string; company?: string; jobDescription?: string } {
  // JSON-LD
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
  for (const s of scripts) {
    try {
      const d = JSON.parse(s.textContent ?? '{}')
      if (d['@type'] === 'JobPosting') {
        return {
          jobTitle: d.title,
          company: d.hiringOrganization?.name,
          jobDescription: typeof d.description === 'string'
            ? d.description.slice(0, 6000)
            : undefined,
        }
      }
    } catch { /* ignore */ }
  }

  const h1 = doc.querySelector('h1')?.textContent?.trim()
  const ogTitle = (doc.querySelector('meta[property="og:title"]') as HTMLMetaElement)?.content
  const ogSite = (doc.querySelector('meta[property="og:site_name"]') as HTMLMetaElement)?.content

  return { jobTitle: ogTitle || h1, company: ogSite }
}

// ── Step indicator ────────────────────────────────────────────────────────────

function stepIndicator(doc: Document): string | undefined {
  const el = doc.querySelector('[aria-label*="step" i], [class*="step-indicator" i], [class*="progress" i]')
  return el?.textContent?.trim() || undefined
}

// ── Main extraction ───────────────────────────────────────────────────────────

export function extractPage(doc: Document, url: string, frameId = 0): FrameSnapshot {
  const allElements = allElementsDeep(doc)
  const candidates = allElements.filter(isCandidate)

  // Separate radios for grouping
  const radiosByName = new Map<string, HTMLInputElement[]>()
  const seenRadioNames = new Set<string>()

  // Checkboxes that share a fieldset get grouped
  const checkboxesByFieldset = new Map<Element | null, HTMLInputElement[]>()

  const soloElements: Element[] = []

  for (const el of candidates) {
    const tag = el.tagName.toUpperCase()
    const inputType = tag === 'INPUT' ? (el.getAttribute('type') ?? 'text').toLowerCase() : ''

    if (tag === 'INPUT' && inputType === 'radio') {
      const name = el.getAttribute('name') || `__unnamed_radio_${_idCounter}`
      if (!radiosByName.has(name)) radiosByName.set(name, [])
      radiosByName.get(name)!.push(el as HTMLInputElement)
      continue
    }
    if (tag === 'INPUT' && inputType === 'checkbox') {
      const fs = el.closest('fieldset') as Element | null
      if (fs) {
        if (!checkboxesByFieldset.has(fs)) checkboxesByFieldset.set(fs, [])
        checkboxesByFieldset.get(fs)!.push(el as HTMLInputElement)
        continue
      }
    }
    soloElements.push(el)
  }

  const fields: Field[] = []

  // Radio groups
  for (const [name, radios] of radiosByName) {
    if (seenRadioNames.has(name)) continue
    seenRadioNames.add(name)
    const grouped = groupRadios(radios, frameId, doc)
    if (!isHidden(radios[0])) fields.push(grouped)
    else {
      // Still add but mark not visible — filter later if needed
      fields.push({ ...grouped, visible: false })
    }
  }

  // Checkbox groups (fieldset-grouped)
  for (const [, boxes] of checkboxesByFieldset) {
    const grouped = groupCheckboxes(boxes, frameId, doc)
    fields.push(grouped)
  }

  // Individual fields
  for (const el of soloElements) {
    if (isHidden(el)) continue

    const kind = fieldKind(el)
    if (kind === 'password') continue // never process password fields

    const { label, sources } = resolveLabel(el, doc)
    const ht = helpText(el, doc)
    const sh = sectionHeading(el)

    let options: FieldOption[] | undefined
    if (el.tagName.toUpperCase() === 'SELECT') options = selectOptions(el as HTMLSelectElement)

    let currentValue: string | string[] | undefined
    const elTag = el.tagName.toUpperCase()
    if (elTag === 'INPUT' || elTag === 'SELECT' || elTag === 'TEXTAREA') {
      currentValue = (el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value || undefined
    }

    const maxLengthAttr = el.getAttribute('maxlength')
    const maxLength = maxLengthAttr ? parseInt(maxLengthAttr, 10) : undefined

    fields.push({
      agentId: getOrStamp(el),
      frameId,
      kind,
      label,
      labelSources: sources,
      name: el.getAttribute('name') || undefined,
      id: el.getAttribute('id') || undefined,
      placeholder: el.getAttribute('placeholder') || undefined,
      ariaLabel: el.getAttribute('aria-label') || undefined,
      helpText: ht,
      sectionHeading: sh,
      required: isRequired(el),
      currentValue,
      options,
      maxLength: Number.isNaN(maxLength ?? NaN) ? undefined : maxLength,
      accept: el.getAttribute('accept') || undefined,
      visible: true,
      disabled: (el as HTMLInputElement).disabled ?? false,
    })
  }

  // Present fields in the order they appear on the page.
  const position = new Map<string, number>()
  allElements.forEach((el, i) => {
    const id = el.getAttribute(IP_ID_ATTR)
    if (id && !position.has(id)) position.set(id, i)
  })
  fields.sort((a, b) => (position.get(a.agentId) ?? 0) - (position.get(b.agentId) ?? 0))

  const { jobTitle, company, jobDescription } = jobInfo(doc)

  return {
    frameId,
    url,
    title: doc.title,
    atsGuess: guessATS(url, doc),
    jobTitle,
    company,
    fields,
    buttons: extractButtons(doc),
  }
}
