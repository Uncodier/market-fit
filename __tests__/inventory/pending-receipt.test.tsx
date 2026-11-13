import { act, renderHook } from "@testing-library/react"
import { clearPendingReceipt, hasPendingReceipt, pendingReceiptKey, writePendingReceipt } from "@/app/bills/pending-receipt"
import { usePendingReceipt } from "@/app/bills/use-pending-receipt"

let mockActorId: string | undefined = "actor-one"
jest.mock("@/app/components/auth/auth-context", () => ({
  useAuthContext: () => ({ user: mockActorId ? { id: mockActorId } : null }),
}))
const siteId = "00000000-0000-4000-8000-000000000001"
const purchaseId = "00000000-0000-4000-8000-000000000002"
const input = {
  siteId, purchaseId, requestId: "00000000-0000-4000-8000-000000000003",
  toLocationId: "00000000-0000-4000-8000-000000000004",
  receivingUserId: "00000000-0000-4000-8000-000000000005",
  lines: [{ purchaseItemId: "00000000-0000-4000-8000-000000000006", quantity: 5 }],
}
const key = pendingReceiptKey("actor-one", siteId, purchaseId)

beforeEach(() => { sessionStorage.clear(); mockActorId = "actor-one" })
afterEach(() => jest.restoreAllMocks())

it("discovers only the authenticated actor/site/bill's saved receipt", () => {
  writePendingReceipt(key, input)
  expect(hasPendingReceipt("actor-one", siteId, purchaseId)).toBe(true)
  expect(hasPendingReceipt("actor-two", siteId, purchaseId)).toBe(false)
  expect(hasPendingReceipt(undefined, siteId, purchaseId)).toBe(false)
  expect(hasPendingReceipt("actor-one", "another-site", purchaseId)).toBe(false)
  expect(hasPendingReceipt("actor-one", siteId, "another-bill")).toBe(false)
  expect(sessionStorage.getItem(key)).toBe(JSON.stringify(input))
})

it.each(["not json", JSON.stringify({ ...input, purchaseId: input.siteId })])("ignores invalid storage without clearing it", raw => {
  sessionStorage.setItem(key, raw)
  expect(hasPendingReceipt("actor-one", siteId, purchaseId)).toBe(false)
  expect(sessionStorage.getItem(key)).toBe(raw)
})

it("tolerates unavailable storage during discovery", () => {
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Unavailable") })
  expect(hasPendingReceipt("actor-one", siteId, purchaseId)).toBe(false)
})

it("updates discovery after save/clear and immediately isolates identity changes", () => {
  const { result, rerender } = renderHook(() => usePendingReceipt(siteId, purchaseId))
  expect(result.current.pending).toBe(false)
  act(() => writePendingReceipt(key, input))
  expect(result.current.pending).toBe(true)
  mockActorId = "actor-two"
  rerender()
  expect(result.current.pending).toBe(false)
  mockActorId = undefined
  rerender()
  expect(result.current.pending).toBe(false)
  mockActorId = "actor-one"
  rerender()
  expect(result.current.pending).toBe(true)
  act(() => clearPendingReceipt(key))
  expect(result.current.pending).toBe(false)
})
