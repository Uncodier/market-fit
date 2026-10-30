/** @jest-environment node */
import { processReplenishmentQueue } from '@/app/api/procurement/replenishment/process/core'

describe('bounded transaction-per-rule worker core', () => {
  test('awaits each transaction and counts failures toward the 25-call bound', async () => {
    let active = false
    const rpc = jest.fn(async () => {
      expect(active).toBe(false)
      active = true
      await new Promise(resolve => setImmediate(resolve))
      active = false
      return { data: { processed: 0, failed: 1, busy: false }, error: null }
    })
    expect(await processReplenishmentQueue({ rpc })).toEqual({ processed: 0, failed: 25, busy: false })
    expect(rpc).toHaveBeenCalledTimes(25)
    expect(rpc).toHaveBeenCalledWith('process_procurement_replenishment', { p_limit: 1 })
  })

  test.each([
    { processed: 0, failed: 0, busy: true },
    { processed: 0, failed: 0, busy: false },
  ])('stops immediately without spinning on %j', async data => {
    const rpc = jest.fn(async () => ({ data, error: null }))
    expect(await processReplenishmentQueue({ rpc })).toEqual(data)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  test.each([
    null, { processed: 25, failed: 0, busy: false }, { processed: 1 },
    { processed: 1, failed: 1, busy: false }, { processed: 1, failed: 0, busy: true },
  ])('rejects incompatible RPC data without calling again: %j', async data => {
    const rpc = jest.fn(async () => ({ data, error: null }))
    await expect(processReplenishmentQueue({ rpc })).rejects.toThrow()
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  test('does not retry transport errors or ambiguous committed work', async () => {
    const rpc = jest.fn(async () => ({ data: null, error: { message: 'Transport failed' } }))
    await expect(processReplenishmentQueue({ rpc })).rejects.toThrow('queue unavailable')
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})