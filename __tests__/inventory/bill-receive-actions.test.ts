/** @jest-environment node */
import { readBillInventoryReceiptLines, receiveBillInventoryLines } from "@/app/bills/receive-inventory-actions"
import { requirePurchaseAccess } from "@/app/purchases/purchase-access"
import { executeBillInventoryReceipt } from "@/app/bills/receive-inventory"
import { InventoryOperationError } from "@/app/inventory/movements/operations"
import { userCanOnLocation } from "@/lib/permissions/location-access"
import { revalidatePath } from "next/cache"
import { inventoryAssistantTools } from "@/app/inventory/assistant-tools"

jest.mock("server-only", () => ({}))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/app/purchases/purchase-access", () => ({ requirePurchaseAccess: jest.fn() }))
jest.mock("@/app/bills/receive-inventory", () => ({ executeBillInventoryReceipt: jest.fn() }))
jest.mock("@/lib/permissions/location-access", () => ({ userCanOnLocation: jest.fn() }))
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const input = { siteId: id(1), purchaseId: id(2), requestId: id(3), toLocationId: id(4), receivingUserId: id(5), lines: [{ purchaseItemId: id(6), quantity: 2 }] }
const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn() }
const supabase = { from: jest.fn(() => query) }
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(requirePurchaseAccess).mockResolvedValue({ supabase, user: { id: id(7) } } as unknown as Awaited<ReturnType<typeof requirePurchaseAccess>>)
  jest.mocked(userCanOnLocation).mockResolvedValue(true)
  jest.mocked(executeBillInventoryReceipt).mockResolvedValue({ success: true, requestId: id(3), movementIds: [], alreadyApplied: false })
  query.maybeSingle.mockResolvedValue({ data: { id: id(2), location_id: id(4), purchase_items: [
    { id: id(6), name: "Widget", catalog_item_id: id(8), quantity: "8", received_quantity: "3", catalog_items: { kind: "product", name: "Widget" } },
    { id: id(9), catalog_item_id: id(10), quantity: 1, received_quantity: 0, catalog_items: { kind: "service", name: "Service" } },
  ] }, error: null })
})
it("reads authoritative product receipt quantities scoped to site, bill and read permission", async () => {
  const result = await readBillInventoryReceiptLines(input.siteId, input.purchaseId)
  expect(requirePurchaseAccess).toHaveBeenCalledWith(input.siteId, "select", input.purchaseId)
  expect(query.eq).toHaveBeenCalledWith("site_id", input.siteId)
  expect(query.eq).toHaveBeenCalledWith("id", input.purchaseId)
  expect(result.data).toEqual([{ id: id(6), name: "Widget", catalog_item_id: id(8), quantity: 8, received_quantity: 3 }])
  expect(result.actorId).toBe(id(7))
})
it("denies inaccessible bill reads without exposing rows", async () => {
  jest.mocked(userCanOnLocation).mockResolvedValue(false)
  expect((await readBillInventoryReceiptLines(input.siteId, input.purchaseId)).data).toEqual([])
})
it("requires update access and shared atomic helper before refreshing bill and inventory", async () => {
  expect((await receiveBillInventoryLines(input)).success).toBe(true)
  expect(requirePurchaseAccess).toHaveBeenCalledWith(input.siteId, "update", input.purchaseId)
  expect(executeBillInventoryReceipt).toHaveBeenCalledWith(supabase, input)
  expect(revalidatePath).toHaveBeenCalledWith(`/bills/${input.purchaseId}`)
})
it("validates receiver and lines before authentication or writes", async () => {
  expect((await receiveBillInventoryLines({ ...input, receivingUserId: "" })).success).toBe(false)
  expect(requirePurchaseAccess).not.toHaveBeenCalled()
  expect(executeBillInventoryReceipt).not.toHaveBeenCalled()
})
it("preserves definite failure codes and sanitizes unknown failures", async () => {
  jest.mocked(executeBillInventoryReceipt).mockRejectedValueOnce(new InventoryOperationError("Rejected", 409, "operation_rejected"))
  expect(await receiveBillInventoryLines(input)).toMatchObject({ success: false, status: 409, code: "operation_rejected" })
  jest.mocked(executeBillInventoryReceipt).mockRejectedValueOnce(new Error("secret provider detail"))
  expect(await receiveBillInventoryLines(input)).toMatchObject({ success: false, status: 503, error: expect.not.stringContaining("secret") })
})
it("manifest requires receiver and incremental bill lines with expanded body limit", () => {
  const tool = inventoryAssistantTools.find(tool => tool.function.name === "inventory_receive_bill")!
  expect(tool.function.parameters.required).toEqual(expect.arrayContaining(["receivingUserId", "lines"]))
  expect(tool.transport.maxBodyBytes).toBe(131_072)
  const bulk = inventoryAssistantTools.find(tool => tool.function.name === "inventory_bulk")!
  expect(bulk.function.description).toContain("cannot receive a partially received bill")
})
