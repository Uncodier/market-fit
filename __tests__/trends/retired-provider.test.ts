/** @jest-environment node */
import { existsSync } from 'node:fs'
import path from 'node:path'

it('has no Twitter trends route or service that could contact the paid provider', () => {
  expect(existsSync(path.join(process.cwd(), 'app/api/trends/twitter/route.ts'))).toBe(false)
  expect(existsSync(path.join(process.cwd(), 'app/services/trends/twitter-service.ts'))).toBe(false)
})