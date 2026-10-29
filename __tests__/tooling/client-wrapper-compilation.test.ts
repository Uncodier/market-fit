/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { transformSync } from 'next/dist/build/swc'

const filename = path.join(process.cwd(), 'app/client-wrapper.tsx')
const source = readFileSync(filename, 'utf8')

it.each([false, true])('compiles the SSR-capable lazy shell with the installed Next compiler (server=%s)', isServerCompiler => {
  const result = transformSync(source, { filename, appDir: path.dirname(filename), isDevelopment: true, isServerCompiler,
    jsc: { parser: { syntax: 'typescript', tsx: true }, target: 'es2022', transform: { react: { runtime: 'automatic' } } } })
  expect(result.code).toContain('layout-client')
  expect(result.code).not.toContain('lazy-dynamic/preload-chunks')
})

it('keeps workspace loading conditional and does not disable its server rendering', () => {
  expect(source).toMatch(/const LayoutClient = lazy\(\(\) => import\("\.\/layout-client"\)\)/)
  expect(source).not.toMatch(/dynamic\(\(\) => import\("\.\/layout-client"\)/)
  expect(source).toContain('if (useLayout)')
  expect(source).toContain('<Suspense fallback=')
  expect(readFileSync(path.join(process.cwd(), 'app/layout.tsx'), 'utf8'))
    .toContain('import "./components/navigation/credits-widget.module.css"')
})