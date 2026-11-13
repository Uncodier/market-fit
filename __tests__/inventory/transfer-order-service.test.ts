/** @jest-environment node */
import { executeTransferOrder } from "@/app/inventory/movements/order-service"
import { transferOrderSchema, transferTransitionSchema } from "@/app/inventory/movements/order-schema"
import type { createClient } from "@/lib/supabase/server"

const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`
const input = { siteId: uuid(1), requestId: uuid(2), fromLocationId: uuid(3), toLocationId: uuid(4),
  status: "requested" as const, items: [{ catalogItemId: uuid(5), quantity: 8 }] }
const transition = { siteId: uuid(1), requestId: uuid(2), orderId: uuid(8), action: "receive" as const,
  revision: 3, lines: [{ lineId: uuid(9), quantity: 2 }] }
const response = { success: true, requestId: uuid(2), orderId: uuid(8), alreadyApplied: false }
function state() {
  const rpc = jest.fn().mockResolvedValue({ data: response, error: null })
  return { rpc, client: { rpc } as Awaited<ReturnType<typeof createClient>> }
}
it("creates a requisition via a single RPC rather than changing levels", async () => {
  const { client, rpc } = state()
  expect(await executeTransferOrder(client, input)).toEqual(response)
  const { siteId, requestId, ...body } = input
  expect(rpc).toHaveBeenCalledWith("create_inventory_transfer_order", { p_site_id: siteId, p_request_id: requestId, p_input: body })
})
it("preserves incremental receipt quantities, revision and idempotency", async () => {
  const { client, rpc } = state()
  await executeTransferOrder(client, transition, true)
  expect(rpc).toHaveBeenCalledWith("transition_inventory_transfer_order", {
    p_site_id: transition.siteId, p_request_id: transition.requestId, p_order_id: transition.orderId,
    p_input: { action: "receive", revision: 3, lines: transition.lines },
  })
})
it.each(["42501", "22023", "23505", "P0001", "40001", "PGRST202"])("sanitizes error %s", async code => {
  const { client, rpc } = state()
  rpc.mockResolvedValue({ data: null, error: { code, message: "Private database detail" } })
  await expect(executeTransferOrder(client, input)).rejects.not.toThrow("Private database detail")
})
it("rejects mismatched result identifiers", async () => {
  const { client, rpc } = state()
  rpc.mockResolvedValue({ data: { ...response, orderId: uuid(10) }, error: null })
  await expect(executeTransferOrder(client, transition, true)).rejects.toMatchObject({ status: 503 })
})
it("requires bounded positive lines, two locations and a supported creation state", () => {
  expect(transferOrderSchema.safeParse({ ...input, status: "received" }).success).toBe(false)
  expect(transferOrderSchema.safeParse({ ...input, toLocationId: input.fromLocationId }).success).toBe(false)
  expect(transferOrderSchema.safeParse({ ...input, items: [] }).success).toBe(false)
})
it("requires explicit reconciliation quantities and reasons", () => {
  expect(transferTransitionSchema.safeParse({ ...transition, action: "reconcile", lines: [{ lineId: uuid(9), writtenOffQuantity: 2 }] }).success).toBe(false)
  expect(transferTransitionSchema.safeParse({ ...transition, action: "reconcile", lines: [{ lineId: uuid(9), returnedQuantity: 2, notes: "Damaged packaging" }] }).success).toBe(true)
  expect(transferTransitionSchema.safeParse({ ...transition, lines: [transition.lines[0], transition.lines[0]] }).success).toBe(false)
})
it("allows unfulfilled products on dispatch but requires at least one positive line", () => {
  expect(transferTransitionSchema.safeParse({ ...transition, action: "dispatch", lines: [
    { lineId: uuid(9), quantity: 0 }, { lineId: uuid(10), quantity: 3 },
  ] }).success).toBe(true)
  expect(transferTransitionSchema.safeParse({ ...transition, action: "dispatch", lines: [{ lineId: uuid(9), quantity: 0 }] }).success).toBe(false)
  expect(transferTransitionSchema.safeParse({ ...transition, lines: [{ lineId: uuid(9), quantity: 0 }] }).success).toBe(false)
})