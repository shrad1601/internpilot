import { test as base, chromium, expect, type BrowserContext, type Page, type Worker } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PAGES_PORT, SERVER_PORT } from './global-setup'

const extPath = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../dist-e2e')

export const pageUrl = (name: string) => `http://127.0.0.1:${PAGES_PORT}/${name}`
export const serverUrl = (path: string) => `http://127.0.0.1:${SERVER_PORT}${path}`

export function latestCode(): string {
  return readFileSync(join(process.env.IP_E2E_HOME!, 'latest-code'), 'utf8').trim()
}

export function savedToken(): string | null {
  const f = join(process.env.IP_E2E_HOME!, 'InternPilot', '.token')
  return existsSync(f) ? readFileSync(f, 'utf8').trim() : null
}

type Fixtures = {
  context: BrowserContext
  sw: Worker
  extensionId: string
  form: Page
  openPanel: () => Promise<Page>
  pair: () => Promise<void>
}

export const test = base.extend<Fixtures>({
  context: async ({}, use) => {
    const ctx = await chromium.launchPersistentContext('', {
      // Playwright's own headless shell can't load extensions; full Chromium's
      // --headless=new can, and opens no windows.
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`,
      ],
    })
    await use(ctx)
    await ctx.close()
  },

  sw: async ({ context }, use) => {
    const sw = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
    await expect.poll(() => sw.evaluate(() => typeof chrome?.storage?.local)).toBe('object')
    await use(sw)
  },

  extensionId: async ({ sw }, use) => {
    await use(new URL(sw.url()).host)
  },

  // The single tab in the normal browser window — what "Activate" targets.
  form: async ({ context }, use) => {
    await use(context.pages()[0] ?? await context.newPage())
  },

  // Opens the side panel UI in its own popup window, like a docked panel.
  openPanel: async ({ context, sw, extensionId }, use) => {
    await use(async () => {
      const url = `chrome-extension://${extensionId}/src/sidepanel/index.html`
      const opened = context.waitForEvent('page', (p) => p.url().startsWith(url))
      await sw.evaluate((u) => chrome.windows.create({ url: u, type: 'popup', width: 420, height: 1000 }), url)
      const panel = await opened
      await panel.waitForLoadState()
      return panel
    })
  },

  // Gives this browser the token from the pairing test (each test gets a fresh profile).
  pair: async ({ sw }, use) => {
    await use(async () => {
      let token = savedToken()
      if (!token) {
        const res = await fetch(serverUrl('/pair'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: latestCode() }),
        })
        token = ((await res.json()) as { token: string }).token
      }
      await sw.evaluate((t) => chrome.storage.local.set({ ipToken: t }), token)
      await new Promise((r) => setTimeout(r, 300)) // let the server log the next code
    })
  },
})

export { expect }
