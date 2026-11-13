/** @jest-environment node */
import { receivePurchaseStock } from "@/app/purchases/receive-stock"
import { requirePurchaseAccess } from "@/app/purchases/purchase-access"
import { getPurchaseById } from "@/app/purchases/purchase-queries"
import { executeInventoryBatch } from "@/app/inventory/movements/operations"
import { revalidatePath } from "next/cache"
import type { Purchase } from "@/app/types"

jest.mock("@/app/purchases/purchase-access", () => ({
  requirePurchaseAccess: jest.fn(), validatePurchaseId: jest.fn(),
}))
jest.mock("@/app/purchases/purchase-queries", () => ({ getPurchaseById: jest.fn() }))
jest.mock("@/app/inventory/movements/operations", () => ({ executeInventoryBatch: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
const siteId = "00000000-0000-4000-8000-000000000001"
const purchaseId = "00000000-0000-4000-8000-000000000002"
const locationId = "00000000-0000-4000-8000-000000000003"

beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(requirePurchaseAccess).mockResolvedValue({ supabase: {}, user: {} } as Awaited<ReturnType<typeof requirePurchaseAccess>>)
  jest.mocked(getPurchaseById).mockResolvedValue({ purchase: { id: purchaseId, locationId } as Purchase, error: null })
  jest.mocked(executeInventoryBatch).mockResolvedValue({ success: true, requestId: purchaseId, movementIds: [siteId], alreadyApplied: false })
})

it("receives bill products in one RPC without trusting UI quantities", async () => {
  expect(await receivePurchaseStock(siteId, purchaseId)).toEqual({ success: true, error: null, alreadyReceived: false })
  expect(requirePurchaseAccess).toHaveBeenCalledWith(siteId, "update", purchaseId)
  expect(executeInventoryBatch).toHaveBeenCalledWith({}, {
    siteId, requestId: expect.any(String), operations: [{ kind: "receipt", purchaseId, toLocationId: locationId }],
  })
  expect(revalidatePath).toHaveBeenCalledWith("/inventory/movements")
})

it("uses the chosen destination and still invokes server authorization on an already-received bill", async () => {
  jest.mocked(getPurchaseById).mockResolvedValue({ purchase: { id: purchaseId, locationId, stockReceived: true } as Purchase, error: null })
  jest.mocked(executeInventoryBatch).mockResolvedValue({ success: true, requestId: purchaseId, movementIds: [], alreadyApplied: false })
  expect(await receivePurchaseStock(siteId, purchaseId, siteId)).toEqual({ success: true, error: null, alreadyReceived: true })
  expect(executeInventoryBatch).toHaveBeenCalledWith({}, expect.objectContaining({ operations: [{ kind: "receipt", purchaseId, toLocationId: siteId }] }))
})

it("does not mark receipt or refresh screens when atomic execution fails", async () => {
  jest.mocked(executeInventoryBatch).mockRejectedValue(new Error("Inventory access denied"))
  expect(await receivePurchaseStock(siteId, purchaseId)).toEqual({ success: false, error: "Inventory access denied" })
  expect(revalidatePath).not.toHaveBeenCalled()
})

it("requires a destination", async () => {
  jest.mocked(getPurchaseById).mockResolvedValue({ purchase: { id: purchaseId, locationId: null } as Purchase, error: null })
  expect(await receivePurchaseStock(siteId, purchaseId)).toHaveProperty("success", false)
  expect(executeInventoryBatch).not.toHaveBeenCalled()
})