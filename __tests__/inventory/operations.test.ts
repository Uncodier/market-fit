/** @jest-environment node */
import { executeInventoryBatch } from "@/app/inventory/movements/operations"
import { batchSchema } from "@/app/inventory/movements/schema"
import type { createClient } from "@/lib/supabase/server"

const siteId = "00000000-0000-4000-8000-000000000001"
const requestId = "00000000-0000-4000-8000-000000000002"
const fromLocationId = "00000000-0000-4000-8000-000000000003"
const toLocationId = "00000000-0000-4000-8000-000000000004"
const catalogItemId = "00000000-0000-4000-8000-000000000005"
const input = { siteId, requestId, operations: [{ kind: "transfer", fromLocationId, toLocationId, catalogItemId, quantity: 3 }] }
const result = { success: true, requestId, movementIds: [catalogItemId], alreadyApplied: false }
function client() {
  const rpc = jest.fn().mockResolvedValue({ data: result, error: null })
  return { rpc, client: { rpc } as unknown as Awaited<ReturnType<typeof createClient>> }
}

it("uses one atomic RPC with the original idempotency key", async () => {
  const state = client()
  expect(await executeInventoryBatch(state.client, input)).toEqual(result)
  expect(state.rpc).toHaveBeenCalledTimes(1)
  expect(state.rpc).toHaveBeenCalledWith("apply_inventory_operations", {
    p_site_id: siteId, p_request_id: requestId, p_operations: input.operations,
  })
})

it.each([0, -1, Infinity, NaN, 1_000_000_001])("rejects invalid transfer quantity %s without a write", async quantity => {
  const state = client()
  await expect(executeInventoryBatch(state.client, { ...input, operations: [{ ...input.operations[0], quantity }] }))
    .rejects.toMatchObject({ status: 400 })
  expect(state.rpc).not.toHaveBeenCalled()
})

it("rejects same-location transfers and oversized batches", () => {
  expect(batchSchema.safeParse({ ...input, operations: [{ ...input.operations[0], toLocationId: fromLocationId }] }).success).toBe(false)
  expect(batchSchema.safeParse({ ...input, operations: Array(101).fill(input.operations[0]) }).success).toBe(false)
})

it("does not allow client-supplied quantities for bill receipts", () => {
  expect(batchSchema.safeParse({ ...input, operations: [{ kind: "receipt", purchaseId: catalogItemId, toLocationId, quantity: 999 }] }).success).toBe(false)
})

it.each([
  ["42501", 403], ["22023", 400], ["23503", 400], ["23505", 409], ["P0001", 409], ["PGRST202", 503],
])("sanitizes database error %s to status %s", async (code, status) => {
  const state = client()
  state.rpc.mockResolvedValue({ data: null, error: { code, message: "Private provider detail" } })
  await expect(executeInventoryBatch(state.client, input)).rejects.toMatchObject({ status })
  await expect(executeInventoryBatch(state.client, input)).rejects.not.toThrow("Private provider detail")
})

it("rejects ambiguous or mismatched RPC responses", async () => {
  const state = client()
  state.rpc.mockResolvedValue({ data: { ...result, requestId: siteId }, error: null })
  await expect(executeInventoryBatch(state.client, input)).rejects.toMatchObject({ status: 503 })
})