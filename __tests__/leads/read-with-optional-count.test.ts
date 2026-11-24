import type { PostgrestSingleResponse } from '@supabase/supabase-js'
import { readWithOptionalCount } from '@/app/leads/read-with-optional-count'

type Row = { id: string }
const row = { id: 'example' }
const ok: PostgrestSingleResponse<Row[]> = { success: true, data: [row], count: 1, status: 200, statusText: 'OK', error: null }

function query(promise: Promise<PostgrestSingleResponse<Row[]>>) {
  return Object.assign(promise, { retry: jest.fn().mockReturnThis(), abortSignal: jest.fn().mockReturnThis() })
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

it('cancels the slow counted query and keeps the faster fallback without an invented total', async () => {
  let finishCount!: (result: PostgrestSingleResponse<Row[]>) => void
  const counted = query(new Promise(resolve => { finishCount = resolve }))
  const fallback = query(Promise.resolve(ok))
  const build = jest.fn((withCount: boolean) => withCount ? counted : fallback)
  const pending = readWithOptionalCount(build)
  await jest.advanceTimersByTimeAsync(4_999)
  expect(build.mock.calls).toEqual([[true]])
  await jest.advanceTimersByTimeAsync(1)
  expect(build.mock.calls).toEqual([[true], [false]])
  expect(counted.abortSignal.mock.calls[0][0].aborted).toBe(true)
  expect(fallback.abortSignal.mock.calls[0][0].aborted).toBe(false)
  await expect(pending).resolves.toMatchObject({ data: [row], count: null, error: null })
  finishCount(ok)
  await expect(pending).resolves.toMatchObject({ count: null })
})

it('bounds both waits even when the SDK ignores cancellation, without a third query', async () => {
  const first = query(new Promise(() => {}))
  const second = query(new Promise(() => {}))
  const build = jest.fn((withCount: boolean) => withCount ? first : second)
  const pending = readWithOptionalCount(build)
  await jest.advanceTimersByTimeAsync(10_000)
  await expect(pending).resolves.toMatchObject({ data: null, count: null, error: { code: 'LEAD_READ_TIMEOUT' } })
  expect(build).toHaveBeenCalledTimes(2)
  expect(second.abortSignal.mock.calls[0][0].aborted).toBe(true)
})