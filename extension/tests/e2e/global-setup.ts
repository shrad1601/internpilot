import { execSync, spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SERVER_PORT = 8799
export const PAGES_PORT = 8798

const here = fileURLToPath(new URL('.', import.meta.url))
const extDir = resolve(here, '../..')
const serverDir = resolve(extDir, '../server')

export const TEST_PROFILE = {
  personal: {
    firstName: 'Testy', lastName: 'McTest', preferredName: '', email: 'testy@example.com',
    schoolEmail: '', phone: '+65 9123 4567', countryCode: '+65', city: 'Singapore',
    country: 'Singapore', address: '', postalCode: '',
  },
  links: { linkedin: 'https://linkedin.com/in/testy', github: '', portfolio: '' },
  education: [], experience: [], projects: [], skills: [],
  availability: { earliestStart: '', latestEnd: '', minWeeks: null, partTimeOk: null },
  workAuth: {}, fixedAnswers: {}, documents: {}, neverFill: [],
}

export default async function globalSetup() {
  execSync('pnpm exec vite build --outDir dist-e2e --emptyOutDir', {
    cwd: extDir,
    env: { ...process.env, VITE_IP_SERVER: `http://127.0.0.1:${SERVER_PORT}` },
    stdio: 'ignore',
  })

  // Isolated HOME so the test server never touches the real ~/InternPilot.
  const home = mkdtempSync(join(tmpdir(), 'ip-e2e-'))
  mkdirSync(join(home, 'InternPilot'), { recursive: true })
  writeFileSync(join(home, 'InternPilot', 'profile.json'), JSON.stringify(TEST_PROFILE))

  const server = spawn(
    join(serverDir, '.venv/bin/python'),
    ['-m', 'uvicorn', 'internpilot.main:app', '--host', '127.0.0.1', '--port', String(SERVER_PORT)],
    { cwd: serverDir, env: { ...process.env, HOME: home, PYTHONUNBUFFERED: '1' } },
  )
  // Keep the newest pairing code on disk; the server issues a new one after each pairing.
  const codeFile = join(home, 'latest-code')
  await new Promise<void>((ok, fail) => {
    let out = ''
    const timer = setTimeout(() => fail(new Error(`test server did not start:\n${out}`)), 20_000)
    const onData = (d: Buffer) => {
      out += d.toString()
      const codes = [...out.matchAll(/Pairing code : (\d{6})/g)]
      if (codes.length) writeFileSync(codeFile, codes[codes.length - 1][1])
      if (codes.length && out.includes('Uvicorn running')) { clearTimeout(timer); ok() }
    }
    server.stdout.on('data', onData)
    server.stderr.on('data', onData)
    server.on('exit', (c) => fail(new Error(`test server exited (${c}):\n${out}`)))
  })

  const pagesDir = join(here, 'pages')
  const pages = createServer((req, res) => {
    const file = join(pagesDir, (req.url ?? '/').split('?')[0])
    if (!file.startsWith(pagesDir) || !existsSync(file)) { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'Content-Type': extname(file) === '.html' ? 'text/html' : 'text/plain' })
    res.end(readFileSync(file))
  })
  await new Promise<void>((ok) => pages.listen(PAGES_PORT, '127.0.0.1', ok))

  process.env.IP_E2E_HOME = home

  return async () => {
    server.kill()
    await new Promise((ok) => pages.close(ok))
  }
}
