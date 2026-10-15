/** @jest-environment node */
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isWorkerDispatchAuthorized } from '@/lib/auth/worker-dispatch'

describe('API-owned worker dispatch boundary', () => {
  const original = process.env.SERVICE_API_KEY
  const originalCron = process.env.CRON_SECRET
  beforeEach(() => {
    process.env.SERVICE_API_KEY = randomBytes(32).toString('hex')
    process.env.CRON_SECRET = randomBytes(32).toString('hex')
  })
  afterAll(() => {
    if (original === undefined) delete process.env.SERVICE_API_KEY
    else process.env.SERVICE_API_KEY = original
    if (originalCron === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalCron
  })
  it('accepts only internal POST dispatch, never old cron GETs or the cron key', () => {
    const request = (method: string, secret: string) => new Request('https://commerce.example.test/worker', {
      method, headers: { 'x-api-key': secret },
    })
    expect(isWorkerDispatchAuthorized(request('POST', process.env.SERVICE_API_KEY!))).toBe(true)
    expect(isWorkerDispatchAuthorized(request('GET', process.env.SERVICE_API_KEY!))).toBe(false)
    expect(isWorkerDispatchAuthorized(request('POST', process.env.CRON_SECRET!))).toBe(false)
    expect(isWorkerDispatchAuthorized(new Request('https://commerce.example.test/worker', {
      method: 'POST', headers: { authorization: `Bearer ${process.env.SERVICE_API_KEY}` },
    }))).toBe(false)
    delete process.env.SERVICE_API_KEY
    expect(isWorkerDispatchAuthorized(request('POST', 'undefined'))).toBe(false)
  })
  it('leaves the app deployment with no cron schedules', () => {
    const config = JSON.parse(readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8'))
    expect(config.crons || []).toEqual([])
  })
})