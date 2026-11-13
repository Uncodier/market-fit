/** @jest-environment node */
import { createInventoryMovement } from "@/app/inventory/movements/actions"
import { createMovementSchema } from "@/app/inventory/movements/schema"
import { executeInventoryBatch } from "@/app/inventory/movements/operations"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/app/inventory/movements/operations", () => ({ executeInventoryBatch: jest.fn(), InventoryOperationError: class extends Error {} }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`
const input = {
  siteId: id(1), requestId: id(2), fromLocationId: id(3), toLocationId: id(4), receivingUserId: id(5),
  notes: "Restock", items: [{ catalogItemId: id(6), quantity: 2 }, { catalogItemId: id(7), quantity: 3.5 }],
}
const client = { auth: { getUser: jest.fn() } }
beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(createClient).mockResolvedValue(client)
  client.auth.getUser.mockResolvedValue({ data: { user: { id: id(9) } }, error: null })
  jest.mocked(executeInventoryBatch).mockResolvedValue({ success: true, requestId: input.requestId, movementIds: [id(10), id(11)], alreadyApplied: false })
})

it("dispatches every line and receiver through one atomic request", async () => {
  expect(await createInventoryMovement(input)).toHaveProperty("success", true)
  expect(executeInventoryBatch).toHaveBeenCalledTimes(1)
  expect(executeInventoryBatch).toHaveBeenCalledWith(client, {
    siteId: input.siteId, requestId: input.requestId,
    operations: input.items.map(item => ({ kind: "transfer", ...item, fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId, notes: input.notes, receivingUserId: input.receivingUserId })),
  })
  expect(revalidatePath).toHaveBeenCalledWith("/inventory/movements")
})

it("preserves legacy pending single-line input", async () => {
  const { items, ...shared } = input
  await createInventoryMovement({ ...shared, ...items[0] })
  expect(executeInventoryBatch).toHaveBeenCalledWith(client, expect.objectContaining({ operations: [
    { kind: "transfer", ...items[0], fromLocationId: shared.fromLocationId, toLocationId: shared.toLocationId,
      notes: shared.notes, receivingUserId: shared.receivingUserId },
  ] }))
})

it.each([{ items: [] }, { items: Array(101).fill(input.items[0]) }, { items: [{ ...input.items[0], quantity: 0 }] }])("rejects invalid item rows without executing", async ({ items }) => {
  expect(await createInventoryMovement({ ...input, items })).toMatchObject({ status: 400 })
  expect(executeInventoryBatch).not.toHaveBeenCalled()
})

it("rejects client-provided receiver names and non-UUID identities", () => {
  expect(createMovementSchema.safeParse({ ...input, receivingUserName: "Forged" }).success).toBe(false)
  expect(createMovementSchema.safeParse({ ...input, receivingUserId: "foreign" }).success).toBe(false)
})