import { readFileSync } from 'fs'
import { join } from 'path'
import { JSDOM } from 'jsdom'
import { describe, it, expect, beforeEach } from 'vitest'
import { extractPage, resetIdCounter } from '../src/content/extract'
import type { Field, FrameSnapshot } from '../src/shared/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function loadFixture(name: string): Document {
  const html = readFileSync(join(__dirname, 'fixtures', name), 'utf-8')
  const dom = new JSDOM(html, { url: 'http://localhost/' })
  return dom.window.document
}

function visibleFields(snap: FrameSnapshot): Field[] {
  return snap.fields.filter((f) => f.visible)
}

function labels(snap: FrameSnapshot): string[] {
  return visibleFields(snap).map((f) => f.label)
}

function fieldByLabel(snap: FrameSnapshot, label: string): Field | undefined {
  return visibleFields(snap).find((f) => f.label.toLowerCase().includes(label.toLowerCase()))
}

beforeEach(() => resetIdCounter())

// ── Greenhouse ────────────────────────────────────────────────────────────────

describe('Greenhouse fixture', () => {
  let snap: FrameSnapshot

  beforeEach(() => {
    const doc = loadFixture('greenhouse.html')
    snap = extractPage(doc, 'https://boards.greenhouse.io/acmecorp/jobs/12345')
  })

  it('detects atsGuess = greenhouse from URL', () => {
    expect(snap.atsGuess).toBe('greenhouse')
  })

  it('extracts job title from h1', () => {
    expect(snap.jobTitle).toMatch(/software engineer/i)
  })

  it('finds all expected visible fields', () => {
    const lbls = labels(snap)
    expect(lbls.some((l) => /first name/i.test(l))).toBe(true)
    expect(lbls.some((l) => /last name/i.test(l))).toBe(true)
    expect(lbls.some((l) => /email/i.test(l))).toBe(true)
    expect(lbls.some((l) => /phone/i.test(l))).toBe(true)
    expect(lbls.some((l) => /resume/i.test(l))).toBe(true)
    expect(lbls.some((l) => /cover letter/i.test(l))).toBe(true)
    expect(lbls.some((l) => /linkedin/i.test(l))).toBe(true)
    expect(lbls.some((l) => /start date/i.test(l))).toBe(true)
    expect(lbls.some((l) => /how did you hear/i.test(l))).toBe(true)
  })

  it('marks required fields correctly', () => {
    const first = fieldByLabel(snap, 'first name')
    expect(first?.required).toBe(true)
    const phone = fieldByLabel(snap, 'phone')
    expect(phone?.required).toBe(false)
  })

  it('detects kind = email for email field', () => {
    const email = fieldByLabel(snap, 'email')
    expect(email?.kind).toBe('email')
  })

  it('detects kind = tel for phone field', () => {
    const phone = fieldByLabel(snap, 'phone')
    expect(phone?.kind).toBe('tel')
  })

  it('detects kind = file for resume', () => {
    const resume = fieldByLabel(snap, 'resume')
    expect(resume?.kind).toBe('file')
  })

  it('detects kind = textarea for cover letter', () => {
    const cover = fieldByLabel(snap, 'cover letter')
    expect(cover?.kind).toBe('textarea')
  })

  it('detects kind = date for start date', () => {
    const d = fieldByLabel(snap, 'start date')
    expect(d?.kind).toBe('date')
  })

  it('detects kind = select for "how did you hear" and has options', () => {
    const sel = fieldByLabel(snap, 'how did you hear')
    expect(sel?.kind).toBe('select')
    expect(sel?.options?.length).toBeGreaterThanOrEqual(4)
  })

  it('extracts radio group for work authorization', () => {
    const wauth = fieldByLabel(snap, 'work authorization')
    expect(wauth?.kind).toBe('radio_group')
    expect(wauth?.options?.length).toBe(2)
  })

  it('extracts a solo checkbox for acknowledge', () => {
    const ack = visibleFields(snap).find((f) => f.kind === 'checkbox')
    expect(ack).toBeDefined()
    expect(ack?.label).toMatch(/acknowledge/i)
  })

  it('does NOT include hidden input fields', () => {
    const lbls = labels(snap)
    expect(lbls.every((l) => !/^bot/.test(l.toLowerCase()))).toBe(true)
  })

  it('extracts submit button', () => {
    const sub = snap.buttons.find((b) => b.role === 'submit')
    expect(sub).toBeDefined()
  })

  it('achieves ≥ 95% label accuracy (9/9 named fields)', () => {
    const lbls = labels(snap)
    const expected = ['first name', 'last name', 'email', 'phone', 'resume', 'cover letter', 'linkedin', 'start date', 'how did you hear']
    const hit = expected.filter((e) => lbls.some((l) => l.toLowerCase().includes(e)))
    expect(hit.length / expected.length).toBeGreaterThanOrEqual(0.95)
  })
})

// ── Lever ─────────────────────────────────────────────────────────────────────

describe('Lever fixture', () => {
  let snap: FrameSnapshot

  beforeEach(() => {
    const doc = loadFixture('lever.html')
    snap = extractPage(doc, 'https://jobs.lever.co/startupinc/abc123/apply')
  })

  it('detects atsGuess = lever from URL', () => {
    expect(snap.atsGuess).toBe('lever')
  })

  it('extracts fields from label-for pattern', () => {
    const lbls = labels(snap)
    expect(lbls.some((l) => /full name/i.test(l))).toBe(true)
    expect(lbls.some((l) => /email/i.test(l))).toBe(true)
    expect(lbls.some((l) => /phone/i.test(l))).toBe(true)
  })

  it('finds resume (file) and cover (textarea)', () => {
    const resume = visibleFields(snap).find((f) => f.kind === 'file')
    expect(resume).toBeDefined()
    const cover = visibleFields(snap).find((f) => f.kind === 'textarea')
    expect(cover).toBeDefined()
  })

  it('finds select for years of experience', () => {
    const exp = fieldByLabel(snap, 'years')
    expect(exp?.kind).toBe('select')
    expect(exp?.options?.length).toBeGreaterThanOrEqual(4)
  })

  it('marks full name and email as required', () => {
    const name = fieldByLabel(snap, 'full name')
    expect(name?.required).toBe(true)
    const email = fieldByLabel(snap, 'email')
    expect(email?.required).toBe(true)
  })

  it('achieves ≥ 95% label accuracy (6/6 named fields)', () => {
    const lbls = labels(snap)
    const expected = ['full name', 'email', 'phone', 'current company', 'linkedin', 'why']
    const hit = expected.filter((e) => lbls.some((l) => l.toLowerCase().includes(e)))
    expect(hit.length / expected.length).toBeGreaterThanOrEqual(0.95)
  })
})

// ── Workday ───────────────────────────────────────────────────────────────────

describe('Workday fixture', () => {
  let snap: FrameSnapshot

  beforeEach(() => {
    const doc = loadFixture('workday.html')
    snap = extractPage(doc, 'http://localhost/workday-test')
  })

  it('detects atsGuess = workday from data-automation-id DOM clue', () => {
    expect(snap.atsGuess).toBe('workday')
  })

  it('extracts combobox fields for country and state', () => {
    const country = fieldByLabel(snap, 'country')
    expect(country?.kind).toBe('combobox')
    const state = fieldByLabel(snap, 'state')
    expect(state?.kind).toBe('combobox')
  })

  it('resolves aria-label on first/last name inputs', () => {
    const lbls = labels(snap)
    expect(lbls.some((l) => /first name/i.test(l))).toBe(true)
    expect(lbls.some((l) => /last name/i.test(l))).toBe(true)
  })

  it('extracts email, phone, address fields', () => {
    const lbls = labels(snap)
    expect(lbls.some((l) => /email/i.test(l))).toBe(true)
    expect(lbls.some((l) => /phone/i.test(l))).toBe(true)
    expect(lbls.some((l) => /address/i.test(l))).toBe(true)
  })

  it('extracts radio group for sponsorship', () => {
    const sponsor = visibleFields(snap).find((f) => f.kind === 'radio_group')
    expect(sponsor).toBeDefined()
    expect(sponsor?.options?.length).toBe(2)
  })

  it('extracts resume file upload with aria-label', () => {
    const resume = visibleFields(snap).find((f) => f.kind === 'file')
    expect(resume?.label).toMatch(/resume/i)
  })

  it('extracts cover letter textarea', () => {
    const cover = fieldByLabel(snap, 'cover')
    expect(cover?.kind).toBe('textarea')
  })

  it('achieves ≥ 95% label accuracy (8/8 named fields)', () => {
    const lbls = labels(snap)
    const expected = ['first name', 'last name', 'email', 'country', 'address', 'phone', 'resume', 'cover']
    const hit = expected.filter((e) => lbls.some((l) => l.toLowerCase().includes(e)))
    expect(hit.length / expected.length).toBeGreaterThanOrEqual(0.95)
  })
})

// ── SuccessFactors ────────────────────────────────────────────────────────────

describe('SuccessFactors fixture (table layout)', () => {
  let snap: FrameSnapshot

  beforeEach(() => {
    const doc = loadFixture('successfactors.html')
    snap = extractPage(doc, 'https://www.successfactors.eu/careers/jobdetails/12345')
  })

  it('detects atsGuess = successfactors from URL', () => {
    expect(snap.atsGuess).toBe('successfactors')
  })

  it('resolves labels from table cell siblings', () => {
    const lbls = labels(snap)
    expect(lbls.some((l) => /first name/i.test(l))).toBe(true)
    expect(lbls.some((l) => /last name/i.test(l))).toBe(true)
    expect(lbls.some((l) => /email/i.test(l))).toBe(true)
  })

  it('finds selects with options (country, education, years)', () => {
    const selects = visibleFields(snap).filter((f) => f.kind === 'select')
    expect(selects.length).toBeGreaterThanOrEqual(3)
    const country = fieldByLabel(snap, 'country')
    expect(country?.options?.length).toBeGreaterThanOrEqual(3)
  })

  it('finds file and textarea', () => {
    const resume = visibleFields(snap).find((f) => f.kind === 'file')
    expect(resume).toBeDefined()
    const cover = visibleFields(snap).find((f) => f.kind === 'textarea')
    expect(cover).toBeDefined()
  })

  it('achieves ≥ 95% label accuracy (9/9 named fields)', () => {
    const lbls = labels(snap)
    const expected = ['first name', 'last name', 'email', 'phone', 'country', 'education', 'years', 'linkedin', 'cover']
    const hit = expected.filter((e) => lbls.some((l) => l.toLowerCase().includes(e)))
    expect(hit.length / expected.length).toBeGreaterThanOrEqual(0.95)
  })
})

// ── Custom (messy) ────────────────────────────────────────────────────────────

describe('Custom / messy form fixture', () => {
  let snap: FrameSnapshot

  beforeEach(() => {
    const doc = loadFixture('custom.html')
    snap = extractPage(doc, 'http://localhost/apply')
  })

  it('resolves label from nearby sibling div', () => {
    const lbls = labels(snap)
    expect(lbls.some((l) => /full name/i.test(l) || /your full name/i.test(l))).toBe(true)
    expect(lbls.some((l) => /email/i.test(l))).toBe(true)
  })

  it('resolves label from aria-label when no label element', () => {
    const phone = fieldByLabel(snap, 'phone')
    expect(phone).toBeDefined()
    expect(phone?.labelSources).toContain('aria-label')
  })

  it('resolves label from placeholder for city', () => {
    const city = fieldByLabel(snap, 'city')
    expect(city).toBeDefined()
    // either placeholder or nearby-text
    expect(['placeholder', 'nearby-text']).toContain(city?.labelSources[0])
  })

  it('resolves wrapping label for github', () => {
    const gh = fieldByLabel(snap, 'github')
    expect(gh).toBeDefined()
    expect(gh?.labelSources).toContain('label-wrap')
  })

  it('extracts select for work type', () => {
    const wt = fieldByLabel(snap, 'work type') ?? fieldByLabel(snap, 'preferred')
    expect(wt?.kind).toBe('select')
    expect(wt?.options?.length).toBeGreaterThanOrEqual(3)
  })

  it('extracts radio group for us citizen', () => {
    const cit = visibleFields(snap).find((f) => f.kind === 'radio_group')
    expect(cit).toBeDefined()
    expect(cit?.options?.length).toBe(2)
  })

  it('extracts individual checkboxes for languages (no fieldset, so not grouped)', () => {
    // No fieldset → 4 individual checkbox fields, not a checkbox_group
    const checkboxes = visibleFields(snap).filter((f) => f.kind === 'checkbox')
    expect(checkboxes.length).toBeGreaterThanOrEqual(4)
  })

  it('does NOT include hidden or bot-trap fields', () => {
    const lbls = labels(snap)
    expect(lbls.every((l) => !/bot_trap/i.test(l))).toBe(true)
  })

  it('does NOT include display:none fields', () => {
    const lbls = labels(snap)
    // The bot_trap is inside a display:none div
    expect(lbls.every((l) => l !== 'Bot Trap')).toBe(true)
  })

  it('achieves ≥ 95% label accuracy (7/7 named fields)', () => {
    const lbls = labels(snap)
    const expected = ['name', 'email', 'phone', 'github', 'work type', 'about', 'resume']
    const hit = expected.filter((e) => lbls.some((l) => l.toLowerCase().includes(e)))
    expect(hit.length / expected.length).toBeGreaterThanOrEqual(0.95)
  })
})

// ── Unit tests: label resolution strategies ───────────────────────────────────

describe('Label resolution', () => {
  beforeEach(() => resetIdCounter())

  function makeDoc(html: string): Document {
    return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, { url: 'http://localhost/' }).window.document
  }

  it('resolves label-for', () => {
    const doc = makeDoc(`<label for="x">My Label</label><input id="x" type="text">`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields[0]?.label).toBe('My Label')
    expect(snap.fields[0]?.labelSources).toContain('label-for')
  })

  it('resolves wrapping label', () => {
    const doc = makeDoc(`<label>Wrap Label <input type="text" name="f"></label>`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields[0]?.label).toBe('Wrap Label')
    expect(snap.fields[0]?.labelSources).toContain('label-wrap')
  })

  it('resolves aria-labelledby', () => {
    const doc = makeDoc(`<span id="lbl">ARIA Label</span><input type="text" aria-labelledby="lbl">`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields[0]?.label).toBe('ARIA Label')
    expect(snap.fields[0]?.labelSources).toContain('aria-labelledby')
  })

  it('resolves aria-label', () => {
    const doc = makeDoc(`<input type="text" aria-label="My Aria">`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields[0]?.label).toBe('My Aria')
    expect(snap.fields[0]?.labelSources).toContain('aria-label')
  })

  it('resolves fieldset legend', () => {
    const doc = makeDoc(`
      <fieldset>
        <legend>Legend Label</legend>
        <input type="radio" name="r" value="a">
        <input type="radio" name="r" value="b">
      </fieldset>`)
    const snap = extractPage(doc, 'http://localhost/')
    const rg = snap.fields.find((f) => f.kind === 'radio_group')
    expect(rg?.label).toBe('Legend Label')
    expect(rg?.labelSources).toContain('legend')
  })

  it('resolves placeholder fallback', () => {
    const doc = makeDoc(`<input type="text" placeholder="Enter value">`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields[0]?.label).toBe('Enter value')
    expect(snap.fields[0]?.labelSources).toContain('placeholder')
  })

  it('resolves humanized name fallback', () => {
    const doc = makeDoc(`<input type="text" name="firstName">`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields[0]?.label).toBe('First Name')
    expect(snap.fields[0]?.labelSources).toContain('name')
  })

  it('strips asterisk and "optional" noise from labels', () => {
    const doc = makeDoc(`<label for="x">Email Address * <span aria-hidden="true">*</span></label><input id="x" type="email">`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields[0]?.label).not.toContain('*')
  })
})

// ── Unit tests: visibility ────────────────────────────────────────────────────

describe('Visibility', () => {
  beforeEach(() => resetIdCounter())

  function makeDoc(html: string): Document {
    return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, { url: 'http://localhost/' }).window.document
  }

  it('excludes type=hidden inputs', () => {
    const doc = makeDoc(`<input type="hidden" name="secret" value="abc">`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields.filter((f) => f.visible)).toHaveLength(0)
  })

  it('excludes elements with display:none inline style', () => {
    const doc = makeDoc(`<div style="display:none"><input type="text" name="trap"></div>`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields.filter((f) => f.visible)).toHaveLength(0)
  })

  it('excludes aria-hidden elements', () => {
    const doc = makeDoc(`<input type="text" name="ghost" aria-hidden="true">`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields.filter((f) => f.visible)).toHaveLength(0)
  })

  it('includes visible inputs', () => {
    const doc = makeDoc(`<label for="v">Visible</label><input id="v" type="text" name="v">`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields.filter((f) => f.visible)).toHaveLength(1)
  })
})

// ── Unit tests: field kinds ───────────────────────────────────────────────────

describe('Field kinds', () => {
  beforeEach(() => resetIdCounter())

  function makeDoc(html: string): Document {
    return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, { url: 'http://localhost/' }).window.document
  }

  it('classifies <select> as select', () => {
    const doc = makeDoc(`<label for="s">Country</label><select id="s"><option value="US">US</option></select>`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields[0]?.kind).toBe('select')
    expect(snap.fields[0]?.options).toHaveLength(1)
  })

  it('classifies <textarea> as textarea', () => {
    const doc = makeDoc(`<label for="t">Bio</label><textarea id="t"></textarea>`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields[0]?.kind).toBe('textarea')
  })

  it('classifies role=combobox as combobox', () => {
    const doc = makeDoc(`<div id="l">State</div><div role="combobox" aria-labelledby="l" tabindex="0">CA</div>`)
    const snap = extractPage(doc, 'http://localhost/')
    const cb = snap.fields.find((f) => f.kind === 'combobox')
    expect(cb).toBeDefined()
  })

  it('groups radio inputs with same name as radio_group', () => {
    const doc = makeDoc(`
      <input type="radio" name="opt" value="a" aria-label="Yes">
      <input type="radio" name="opt" value="b" aria-label="No">`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields).toHaveLength(1)
    expect(snap.fields[0]?.kind).toBe('radio_group')
    expect(snap.fields[0]?.options?.length).toBe(2)
  })

  it('groups checkboxes in fieldset as checkbox_group', () => {
    const doc = makeDoc(`
      <fieldset>
        <legend>Skills</legend>
        <label><input type="checkbox" name="js" value="js"> JS</label>
        <label><input type="checkbox" name="py" value="py"> Python</label>
      </fieldset>`)
    const snap = extractPage(doc, 'http://localhost/')
    const cg = snap.fields.find((f) => f.kind === 'checkbox_group')
    expect(cg).toBeDefined()
    expect(cg?.label).toBe('Skills')
    expect(cg?.options?.length).toBe(2)
  })
})

// ── Unit tests: button extraction ─────────────────────────────────────────────

describe('Button extraction', () => {
  beforeEach(() => resetIdCounter())

  function makeDoc(html: string): Document {
    return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, { url: 'http://localhost/' }).window.document
  }

  it('classifies submit buttons', () => {
    const doc = makeDoc(`<button type="submit">Submit Application</button>`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.buttons[0]?.role).toBe('submit')
  })

  it('classifies next buttons', () => {
    const doc = makeDoc(`<button>Next Step</button>`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.buttons[0]?.role).toBe('next')
  })

  it('classifies back buttons', () => {
    const doc = makeDoc(`<button>Previous</button>`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.buttons[0]?.role).toBe('back')
  })

  it('classifies save draft buttons', () => {
    const doc = makeDoc(`<button>Save Draft</button>`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.buttons[0]?.role).toBe('save')
  })

  it('omits buttons with no text', () => {
    const doc = makeDoc(`<button></button><button>Apply</button>`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.buttons).toHaveLength(1)
    expect(snap.buttons[0]?.text).toBe('Apply')
  })
})

// ── Unit tests: ATS detection ─────────────────────────────────────────────────

describe('ATS detection', () => {
  beforeEach(() => resetIdCounter())

  function simpleDoc(): Document {
    return new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { url: 'http://localhost/' }).window.document
  }

  it('detects greenhouse from URL', () => {
    const snap = extractPage(simpleDoc(), 'https://boards.greenhouse.io/company/jobs/12345')
    expect(snap.atsGuess).toBe('greenhouse')
  })

  it('detects lever from URL', () => {
    const snap = extractPage(simpleDoc(), 'https://jobs.lever.co/company/uuid/apply')
    expect(snap.atsGuess).toBe('lever')
  })

  it('detects workday from URL', () => {
    const snap = extractPage(simpleDoc(), 'https://company.wd1.myworkdayjobs.com/careers')
    expect(snap.atsGuess).toBe('workday')
  })

  it('detects successfactors from URL', () => {
    const snap = extractPage(simpleDoc(), 'https://successfactors.eu/careers/jobdetails/12345')
    expect(snap.atsGuess).toBe('successfactors')
  })

  it('falls back to "other" for unknown URLs', () => {
    const snap = extractPage(simpleDoc(), 'https://example.com/careers/apply')
    expect(snap.atsGuess).toBe('other')
  })

  it('detects workday from data-automation-id DOM clue', () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body><div data-automation-id="test"></div></body></html>`, { url: 'http://localhost/' })
    const snap = extractPage(dom.window.document, 'http://localhost/')
    expect(snap.atsGuess).toBe('workday')
  })
})

// ── Unit tests: required detection ───────────────────────────────────────────

describe('Required detection', () => {
  beforeEach(() => resetIdCounter())

  function makeDoc(html: string): Document {
    return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, { url: 'http://localhost/' }).window.document
  }

  it('detects required attr', () => {
    const doc = makeDoc(`<label for="x">Name</label><input id="x" type="text" required>`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields[0]?.required).toBe(true)
  })

  it('detects aria-required=true', () => {
    const doc = makeDoc(`<label for="x">Name</label><input id="x" type="text" aria-required="true">`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields[0]?.required).toBe(true)
  })

  it('detects asterisk in label', () => {
    const doc = makeDoc(`<label for="x">Name *</label><input id="x" type="text">`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields[0]?.required).toBe(true)
  })

  it('marks non-required fields as false', () => {
    const doc = makeDoc(`<label for="x">Phone</label><input id="x" type="tel">`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields[0]?.required).toBe(false)
  })
})

// ── Unit tests: id counter isolation ─────────────────────────────────────────

describe('ID counter isolation', () => {
  it('resets between test runs', () => {
    resetIdCounter()
    const dom1 = new JSDOM(`<!DOCTYPE html><html><body><input type="text" name="a"></body></html>`, { url: 'http://localhost/' })
    const snap1 = extractPage(dom1.window.document, 'http://localhost/')
    const id1 = snap1.fields[0]?.agentId

    resetIdCounter()
    const dom2 = new JSDOM(`<!DOCTYPE html><html><body><input type="text" name="a"></body></html>`, { url: 'http://localhost/' })
    const snap2 = extractPage(dom2.window.document, 'http://localhost/')
    const id2 = snap2.fields[0]?.agentId

    expect(id1).toBe(id2) // same counter start → same id
  })
})

// ── Safety + stamping ─────────────────────────────────────────────────────────

describe('captcha and id stamping', () => {
  function docFrom(html: string): Document {
    return new JSDOM(html, { url: 'http://localhost/' }).window.document
  }

  it('never treats captcha response fields as form fields', () => {
    const doc = docFrom(`<form>
      <label for="e">Email</label><input id="e" type="email">
      <textarea id="g-recaptcha-response-100000" name="g-recaptcha-response"></textarea>
      <textarea name="h-captcha-response"></textarea>
    </form>`)
    const snap = extractPage(doc, 'http://localhost/')
    expect(snap.fields.map((f) => f.label)).toEqual(['Email'])
  })

  it('re-stamps elements carrying ids from a stale script instance', () => {
    const doc = docFrom(`<label for="a">First Name</label><input id="a" data-ip-id="ip-0">
      <label for="b">Last Name</label><input id="b">`)
    const ids = extractPage(doc, 'http://localhost/').fields.map((f) => f.agentId)
    expect(new Set(ids).size).toBe(2)
    expect(ids).not.toContain('ip-0')
  })
})
