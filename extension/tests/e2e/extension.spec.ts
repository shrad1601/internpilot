import type { Page, Worker } from '@playwright/test'
import { test, expect, pageUrl, serverUrl, savedToken, latestCode } from './fixtures'

async function activate(panel: Page) {
  await expect(panel.getByText('Server connected')).toBeVisible()
  await panel.getByRole('button', { name: 'Activate' }).click()
}

async function card(panel: Page, n: number, total: number) {
  await expect(panel.getByText(`Action ${n} of ${total}`)).toBeVisible()
}

async function tabIdFor(sw: Worker, url: string): Promise<number> {
  return sw.evaluate(async (u) => (await chrome.tabs.query({ url: u }))[0].id!, url)
}

// ── Pairing ───────────────────────────────────────────────────────────────────

test('1. pairs through Settings and shows Server connected', async ({ openPanel }) => {
  const panel = await openPanel()
  await expect(panel.getByText('Re-pair needed')).toBeVisible()
  await panel.getByRole('button', { name: 'Settings' }).click()

  await panel.getByPlaceholder('000000').fill('000000')
  await panel.getByRole('button', { name: 'Pair' }).click()
  await expect(panel.getByText(/Invalid or expired code/)).toBeVisible()

  await panel.getByPlaceholder('000000').fill(latestCode())
  await panel.getByRole('button', { name: 'Pair' }).click()
  await expect(panel.getByText('Paired ✓')).toBeVisible()
  await expect(panel.getByText('Server connected')).toBeVisible()
  expect(savedToken()).toBeTruthy()
})

test('2. a stale token shows Re-pair needed instead of connected', async ({ sw, openPanel }) => {
  await sw.evaluate(() => chrome.storage.local.set({ ipToken: 'stale-token' }))
  const panel = await openPanel()
  await expect(panel.getByText('Re-pair needed')).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Activate' })).toBeDisabled()
})

// ── Reading the page ──────────────────────────────────────────────────────────

test('3. reads fields in page order with real question labels', async ({ form, pair, openPanel }) => {
  await pair()
  await form.goto(pageUrl('apply.html'))
  const panel = await openPanel()
  await activate(panel)
  await card(panel, 1, 7)

  await panel.getByText('Fields (7)').click()
  const labels = await panel.locator('details span.flex-1').allTextContents()
  expect(labels).toEqual([
    'First Name', 'Last Name', 'Email', 'Phone Number',
    'What is your favourite programming paradigm?', 'GPA', 'Why do you want this role?',
  ])
})

// ── The approval flow ─────────────────────────────────────────────────────────

test('4. fill, edit, skip and answer all apply to the page; nothing is submitted', async ({ form, pair, openPanel }) => {
  await pair()
  await form.goto(pageUrl('apply.html'))
  const panel = await openPanel()
  await activate(panel)

  // 1 — approve a profile value
  await card(panel, 1, 7)
  await expect(panel.getByTestId('field-label')).toHaveText('First Name')
  await panel.getByRole('button', { name: 'Fill' }).click()
  await expect(form.locator('#fn')).toHaveValue('Testy')

  // 2 — edit before approving
  await card(panel, 2, 7)
  await expect(panel.getByTestId('field-label')).toHaveText('Last Name')
  await panel.locator('input[type="text"]').fill('Edited')
  await panel.getByRole('button', { name: 'Fill' }).click()
  await expect(form.locator('#ln')).toHaveValue('Edited')

  // 3 — skip moves on and leaves the field empty
  await card(panel, 3, 7)
  await expect(panel.getByTestId('field-label')).toHaveText('Email')
  await panel.getByRole('button', { name: 'Skip' }).click()
  await card(panel, 4, 7)
  await expect(form.locator('#em')).toHaveValue('')

  // 4 — phone
  await panel.getByRole('button', { name: 'Fill' }).click()
  await expect(form.locator('#ph')).toHaveValue('+65 9123 4567')

  // 5 — answer a radio question with a suggestion
  await card(panel, 5, 7)
  await expect(panel.getByText("What should I enter for 'What is your favourite programming paradigm?'")).toBeVisible()
  await panel.getByRole('button', { name: 'Object-oriented' }).click()
  await panel.getByRole('button', { name: 'Submit' }).click()
  await expect(form.locator('input[value="oop"]')).toBeChecked()

  // 6 — sensitive field asks, and skipping leaves it untouched
  await card(panel, 6, 7)
  await expect(panel.getByText("What should I enter for 'GPA'?")).toBeVisible()
  await panel.getByRole('button', { name: 'Skip' }).click()
  await expect(form.locator('#gpa')).toHaveValue('')

  // 7 — free-text answer
  await card(panel, 7, 7)
  await panel.getByPlaceholder('Your answer…').fill('I like building tools')
  await panel.getByRole('button', { name: 'Submit' }).click()
  await expect(form.locator('#why')).toHaveValue('I like building tools')

  await expect(panel.getByText('✓ Done')).toBeVisible()
  await expect(panel.getByText('5 fields filled')).toBeVisible() // 3 approved + 2 answered
  expect(await form.evaluate(() => (window as any).__submitted ?? false)).toBe(false)
  expect(await form.evaluate(() => (window as any).__applied ?? false)).toBe(false)
  await expect(form.locator('#pw')).toHaveValue('')
  await expect(form.locator('#g-recaptcha-response')).toHaveValue('')
})

test('5. STOP ends the run and removes the page overlay', async ({ form, pair, openPanel }) => {
  await pair()
  await form.goto(pageUrl('apply.html'))
  const panel = await openPanel()
  await activate(panel)
  await card(panel, 1, 7)
  await expect(form.locator('#internpilot-overlay')).toHaveCount(1)

  await panel.getByRole('button', { name: 'STOP' }).click()
  await expect(panel.getByText('⏹ Stopped')).toBeVisible()
  await expect(form.locator('#internpilot-overlay')).toHaveCount(0)
  await expect(form.locator('#fn')).toHaveValue('')
})

test('6. reopening the panel resumes on the current card', async ({ form, pair, openPanel }) => {
  await pair()
  await form.goto(pageUrl('apply.html'))
  let panel = await openPanel()
  await activate(panel)
  await card(panel, 1, 7)
  await panel.getByRole('button', { name: 'Fill' }).click()
  await card(panel, 2, 7)
  await panel.close()

  panel = await openPanel()
  await card(panel, 2, 7)
  await expect(panel.getByTestId('field-label')).toHaveText('Last Name')
  await panel.getByRole('button', { name: 'Fill' }).click()
  await expect(form.locator('#ln')).toHaveValue('McTest')
})

// ── Edge cases ────────────────────────────────────────────────────────────────

test('7. a page with no fields shows a clear error', async ({ form, pair, openPanel }) => {
  await pair()
  await form.goto(pageUrl('empty.html'))
  const panel = await openPanel()
  await activate(panel)
  // The extension retries for ~4.5s in case the form is still rendering.
  await expect(panel.getByText(/No form fields found on this page/)).toBeVisible({ timeout: 10_000 })
  await expect(panel.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('8. fills a field inside a same-origin iframe', async ({ form, pair, openPanel }) => {
  await pair()
  await form.goto(pageUrl('frame-host.html'))
  await form.frameLocator('#form').locator('#fn').waitFor()
  const panel = await openPanel()
  await activate(panel)
  await card(panel, 1, 1)
  await panel.getByRole('button', { name: 'Fill' }).click()
  await expect(form.frameLocator('#form').locator('#fn')).toHaveValue('Testy')
})

test('9. fills a field inside shadow DOM', async ({ form, pair, openPanel }) => {
  await pair()
  await form.goto(pageUrl('shadow.html'))
  const panel = await openPanel()
  await activate(panel)
  await card(panel, 1, 1)
  await expect(panel.getByTestId('field-label')).toHaveText('Email address')
  await panel.getByRole('button', { name: 'Fill' }).click()
  await expect(form.locator('x-field').locator('#sh-email')).toHaveValue('testy@example.com')
})

test('10. refuses to click Submit or Apply even when told to', async ({ form, sw, pair, openPanel }) => {
  await pair()
  await form.goto(pageUrl('apply.html'))
  const panel = await openPanel()
  await activate(panel)
  await card(panel, 1, 7)

  const tabId = await tabIdFor(sw, pageUrl('apply.html'))
  for (const sel of ['#submit', '#apply']) {
    const agentId = await form.locator(sel).getAttribute('data-ip-id')
    expect(agentId).toBeTruthy()
    const res = await sw.evaluate(([t, id]) => chrome.tabs.sendMessage(t as number, {
      kind: 'FILL_ACTION', runId: 'x', idx: 0,
      action: { type: 'click', agentId: id as string, purpose: 'next' },
    }, { frameId: 0 }), [tabId, agentId] as const)
    expect(res).toMatchObject({ success: false, error: expect.stringContaining('Refused') })
  }
  expect(await form.evaluate(() => (window as any).__submitted ?? false)).toBe(false)
  expect(await form.evaluate(() => (window as any).__applied ?? false)).toBe(false)
})

test('11. reloading the extension with the form already open still works', async ({ context, form, sw, extensionId, pair }) => {
  await pair()
  await form.goto(pageUrl('apply.html'))

  // Same as clicking ↺ in chrome://extensions: the tab keeps an orphaned script.
  const reborn = context.waitForEvent('serviceworker')
  await sw.evaluate(() => chrome.runtime.reload()).catch(() => {})
  const sw2 = await reborn
  await expect.poll(() => sw2.evaluate(() => typeof chrome?.windows?.create)).toBe('function')

  const url = `chrome-extension://${extensionId}/src/sidepanel/index.html`
  const opened = context.waitForEvent('page', (p) => p.url().startsWith(url))
  await sw2.evaluate((u) => chrome.windows.create({ url: u, type: 'popup', width: 420, height: 1000 }), url)
  const panel = await opened

  await activate(panel)
  await card(panel, 1, 7)
  await panel.getByRole('button', { name: 'Fill' }).click()
  await expect(form.locator('#fn')).toHaveValue('Testy')
})

// ── Profile tab ───────────────────────────────────────────────────────────────

test('12. profile tab loads from and saves to the server', async ({ pair, openPanel }) => {
  await pair()
  const panel = await openPanel()
  await panel.getByRole('button', { name: 'Profile' }).click()
  const first = panel.locator('label:has-text("First Name") + input')
  await expect(first).toHaveValue('Testy')

  const city = panel.locator('label:has-text("City") + input')
  await city.fill('Testville')
  await panel.getByRole('button', { name: 'Save Profile' }).click()
  await expect(panel.getByRole('button', { name: 'Saved ✓' })).toBeVisible()

  const saved = await (await fetch(serverUrl('/profile'), { headers: { 'x-ip-token': savedToken()! } })).json()
  expect(saved.personal.city).toBe('Testville')
  expect(saved.personal.firstName).toBe('Testy')

  await city.fill('Singapore')
  await panel.getByRole('button', { name: 'Save Profile' }).click()
  await expect(panel.getByRole('button', { name: 'Saved ✓' })).toBeVisible()
})
