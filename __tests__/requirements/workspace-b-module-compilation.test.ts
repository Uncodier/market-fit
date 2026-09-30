/** @jest-environment node */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { transformSync } from 'next/dist/build/swc'

const directory = join(process.cwd(), 'app/requirements/[id]')
const modules = readdirSync(directory).filter(name => /\.(ts|tsx)$/.test(name))

it.each(modules)('compiles the extracted requirement module %s', name => {
  const filename = join(directory, name)
  const source = readFileSync(filename, 'utf8')
  expect(source.split('\n').length).toBeLessThan(500)
  const output = transformSync(source, {
    filename,
    jsc: {
      parser: { syntax: 'typescript', tsx: name.endsWith('.tsx') },
      target: 'es2022',
      transform: { react: { runtime: 'automatic' } },
    },
  })
  expect(output.code).toBeTruthy()
})