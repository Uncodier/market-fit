/** @jest-environment node */
import { POST } from "@/app/api/inventory/transfers/route"
import { requireInventoryApiAccess } from "@/app/api/inventory/auth"
import { executeTransferOrder } from "@/app/inventory/movements/order-service"
import { InventoryOperationError } from "@/app/inventory/movements/operations"
import { NextResponse } from "next/server"

jest.mock("@/app/api/inventory/auth", () => ({ requireInventoryApiAccess: jest.fn() }))
jest.mock("@/app/inventory/movements/order-service", () => ({ executeTransferOrder: jest.fn() }))
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`
const input = { siteId: id(1), requestId: id(2), fromLocationId: id(3), toLocationId: id(4),
  status: "requested", items: [{ catalogItemId: id(5), quantity: 2 }] }
const client = {}
function request(body: unknown) {
  return new Request("http://localhost/api/inventory/transfers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
}
beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(requireInventoryApiAccess).mockResolvedValue({ supabase: client, userId: id(6), role: "owner", userEmail: null })
  jest.mocked(executeTransferOrder).mockResolvedValue({ success: true, orderId: id(7), requestId: id(2), alreadyApplied: false })
})
it("authenticates the actor and executes creation with the user-scoped client", async () => {
  const response = await POST(request({ operation: "create", input }))
  expect(response.status).toBe(200)
  expect(requireInventoryApiAccess).toHaveBeenCalledWith(expect.any(Request), input.siteId)
  expect(executeTransferOrder).toHaveBeenCalledWith(client, input, false)
})
it("cannot execute without authentication", async () => {
  jest.mocked(requireInventoryApiAccess).mockResolvedValue({ error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) })
  expect((await POST(request({ operation: "create", input }))).status).toBe(401)
  expect(executeTransferOrder).not.toHaveBeenCalled()
})
it("rejects forced status, missing lines, unknown fields and oversize payloads", async () => {
  for (const body of [
    { operation: "create", input: { ...input, status: "received" } },
    { operation: "transition", input: { siteId: id(1), orderId: id(7), requestId: id(2), revision: 1, action: "receive" } },
    { operation: "create", input, userId: id(6) },
  ]) expect((await POST(request(body))).status).toBe(400)
  expect((await POST(request({ operation: "create", input: { ...input, notes: "x".repeat(140_000) } }))).status).toBe(413)
  expect(executeTransferOrder).not.toHaveBeenCalled()
})
it("returns definite permission/state failures without raw database details", async () => {
  jest.mocked(executeTransferOrder).mockRejectedValue(new InventoryOperationError("Transfer state changed", 409, "operation_rejected"))
  const response = await POST(request({ operation: "create", input }))
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({ error: "Transfer state changed", code: "operation_rejected" })
})
it("preserves incremental transition input and version", async () => {
  const transition = { siteId: id(1), orderId: id(7), requestId: id(2), revision: 3, action: "receive", lines: [{ lineId: id(8), quantity: 1 }] }
  expect((await POST(request({ operation: "transition", input: transition }))).status).toBe(200)
  expect(executeTransferOrder).toHaveBeenCalledWith(client, transition, true)
})