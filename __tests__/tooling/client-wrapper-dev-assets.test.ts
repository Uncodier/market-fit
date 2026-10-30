/** @jest-environment node */
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { chromium, expect as browserExpect } from 'playwright/test'
import { fetch as nodeFetch } from 'next/dist/compiled/@edge-runtime/primitives/fetch'

const root = process.cwd()
let child: ChildProcess | undefined
let fixture: string | undefined

function write(relative: string, content: string) {
  const file = path.join(fixture!, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as net.AddressInfo).port
  await new Promise<void>(resolve => server.close(() => resolve()))
  return port
}

afterEach(async () => {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM')
    await new Promise<void>(resolve => {
      const timer = setTimeout(() => { child?.kill('SIGKILL'); resolve() }, 5000)
      child!.once('exit', () => { clearTimeout(timer); resolve() })
    })
  }
  if (fixture) fs.rmSync(fixture, { recursive: true, force: true })
  child = undefined
  fixture = undefined
})

it.each(['turbopack', 'webpack'] as const)('serves emitted shell JS/CSS and hydrates with %s without external dependencies', async bundler => {
  // Do not place a Next project below an existing app: Turbopack may discover
  // ancestor middleware/pages when determining project structure.
  const base = path.join(path.dirname(root), '.qa-compiler-fixtures')
  fs.mkdirSync(base, { recursive: true })
  fixture = fs.mkdtempSync(path.join(base, 'layout-'))
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir')
  write('package.json', JSON.stringify({ name: 'isolated-shell-compiler-fixture', private: true }))
  write('next.config.js', `module.exports={turbopack:{root:${JSON.stringify(path.dirname(root))}},devIndicators:false}`)
  write('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'es2018', module: 'esnext', moduleResolution: 'bundler',
    jsx: 'react-jsx', baseUrl: '.', paths: { '@/*': ['./*'] }, esModuleInterop: true, skipLibCheck: true }, include: ['app/**/*.tsx', 'app/**/*.ts'] }))
  // Reuse the authored lazy boundary/routes/styles; stub only data-bearing leaf
  // components. This tests the compiler/runtime, not fabricated API responses.
  write('app/client-wrapper.tsx', fs.readFileSync(path.join(root, 'app/client-wrapper.tsx'), 'utf8'))
  write('app/components/PrivateTypography.tsx', fs.readFileSync(path.join(root, 'app/components/PrivateTypography.tsx'), 'utf8'))
  write('app/config/routes.ts', fs.readFileSync(path.join(root, 'app/config/routes.ts'), 'utf8'))
  write('app/documents/internal-back.ts', 'export function rememberInternalPath(_pathname: string) {}')
  for (const name of ['DemoBanner', 'VersionCheck', 'permissions/ViewOnlyBanner']) {
    write(`app/components/${name}.tsx`, 'export default function FixtureLeaf(){return null}')
  }
  write('app/components/onboarding/GuidedTour.tsx', 'export function GuidedTour(){return null}')
  write('app/components/navigation/credits-widget.module.css', fs.readFileSync(path.join(root, 'app/components/navigation/credits-widget.module.css'), 'utf8'))
  write('app/layout-client.tsx', `"use client";import{useState}from'react';import styles from './components/navigation/credits-widget.module.css';
export default function LayoutClient({children}:{children:React.ReactNode}){const[n,set]=useState(0);return <main aria-label="Workspace"><aside>Workspace sidebar</aside><div className={styles.trigger}><div className={styles.ringFrame}><svg className={styles.ring} data-testid="credit-ring"/></div></div><button onClick={()=>set(n+1)}>Shell count {n}</button>{children}</main>}`)
  write('app/layout.tsx', `import './components/navigation/credits-widget.module.css';export default function Root({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}`)
  write('app/[...route]/page.tsx', `import Link from 'next/link';import ClientWrapper from '../client-wrapper';export default function Page(){return <><nav><Link href="/content">Content</Link><Link href="/auth">Auth</Link></nav><ClientWrapper><h1>Fixture screen</h1></ClientWrapper></>}`)
  const port = await freePort()
  const origin = `http://127.0.0.1:${port}`
  let output = ''
  const allowed = ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'SYSTEMROOT']
  const env = Object.fromEntries(allowed.filter(key => process.env[key]).map(key => [key, process.env[key]!]))
  const serverProcess = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', fixture,
    '--hostname', '127.0.0.1', '--port', String(port), ...(bundler === 'webpack' ? ['--webpack'] : [])], {
    cwd: fixture, env: { ...env, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
  })
  child = serverProcess
  serverProcess.stdout?.on('data', value => { output = (output + value).slice(-20_000) })
  serverProcess.stderr?.on('data', value => { output = (output + value).slice(-20_000) })
  const deadline = Date.now() + 75_000
  let html = ''
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) throw new Error(`Isolated Next fixture exited: ${output}`)
    try {
      const response = await nodeFetch(`${origin}/content`, { signal: AbortSignal.timeout(5000) })
      if (response.ok) { html = await response.text(); break }
    } catch { /* Wait only for this newly started compiler fixture. */ }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  if (!html) throw new Error(`Isolated Next fixture did not render: ${output}`)
  expect(html).toContain('Workspace sidebar')
  const assets = [...new Set(Array.from(html.matchAll(/(?:src|href)="([^"#]*\/_next\/[^"#]+)"/g), match => match[1].replace(/&amp;/g, '&')))]
  expect(assets.some(asset => asset.includes('.css'))).toBe(true)
  expect(assets.some(asset => asset.includes('.js'))).toBe(true)
  for (const asset of assets) expect((await nodeFetch(new URL(asset, origin).href)).status).toBe(200)
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.name))
    page.on('response', response => { if (new URL(response.url()).pathname.startsWith('/_next/static/') && response.status() >= 400) errors.push('asset-http-failure') })
    await page.route('**/*', async route => {
      if (new URL(route.request().url()).origin !== origin) { await route.abort(); errors.push('external-fixture-request'); return }
      await route.continue()
    })
    await page.goto(`${origin}/auth`, { waitUntil: 'load' })
    expect(await page.getByText('Workspace sidebar').count()).toBe(0)
    await page.getByRole('link', { name: 'Content', exact: true }).click()
    await page.getByRole('button', { name: 'Shell count 0', exact: true }).click()
    await page.getByRole('button', { name: 'Shell count 1', exact: true }).waitFor()
    expect(await page.getByTestId('credit-ring').evaluate(element => getComputedStyle(element).width)).toBe('24px')
    await page.getByRole('link', { name: 'Auth', exact: true }).click()
    await page.waitForURL(`${origin}/auth`)
    await page.getByRole('heading', { name: 'Fixture screen' }).waitFor()
    await browserExpect(page.getByText('Workspace sidebar')).toHaveCount(0)
    expect(errors).toEqual([])
  } finally { await browser.close() }
}, 120_000)