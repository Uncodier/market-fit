import { z } from 'zod'

const singleResult = z.object({
  processed: z.number().int().min(0).max(1),
  failed: z.number().int().min(0).max(1),
  busy: z.boolean(),
}).strict().refine(value => value.processed + value.failed <= 1 && (!value.busy || value.processed + value.failed === 0))

type WorkerClient = {
  rpc: (name: string, args: { p_limit: number }) => PromiseLike<{ data: unknown; error: unknown }>
}

/** Await each RPC: its inventory and queue locks must commit before the next rule. */
export async function processReplenishmentQueue(service: WorkerClient) {
  const totals = { processed: 0, failed: 0, busy: false }
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const result = await service.rpc('process_procurement_replenishment', { p_limit: 1 })
    if (result.error) throw new Error('Replenishment queue unavailable')
    const job = singleResult.parse(result.data)
    totals.processed += job.processed
    totals.failed += job.failed
    totals.busy = job.busy
    if (job.busy || job.processed + job.failed === 0) break
  }
  return totals
}