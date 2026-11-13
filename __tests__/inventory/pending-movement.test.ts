import { pendingMovementKey, readPendingMovement, writePendingMovement, type PendingMovement } from "@/app/inventory/movements/pending-movement"

const key = pendingMovementKey("actor", "site")
const common = { siteId: "site", requestId: "request", fromLocationId: "source", toLocationId: "destination" }
const item = { catalogItemId: "item", quantity: 2.5 }
const batch = { ...common, items: [item], receivingUserId: "receiver" }

beforeEach(() => sessionStorage.clear())

test.each<PendingMovement>([{ ...common, ...item }, batch])("v1 storage restores both shapes without changing their payload", input => {
  writePendingMovement(key, input)
  expect(key).toBe("inventory:pending-movement:v1:actor:site")
  expect(readPendingMovement(key, "site")).toEqual(input)
  expect(readPendingMovement(key, "site")).toHaveProperty("requestId", "request")
})

test.each([
  null, [], {}, { ...batch, siteId: "another-site" }, { ...batch, requestId: "" },
  { ...batch, fromLocationId: "DESTINATION" }, { ...batch, receivingUserId: null },
  { ...batch, receivingUserId: " " }, { ...batch, receivingUserId: 4 },
  { ...batch, extra: true }, { ...batch, notes: "x".repeat(1001) },
  { ...batch, items: [] }, { ...batch, items: Array.from({ length: 101 }, () => item) },
  { ...batch, items: [null] }, { ...batch, items: [{ ...item, quantity: "2" }] },
  { ...batch, items: [{ ...item, quantity: 0 }] }, { ...batch, items: [{ ...item, quantity: -1 }] },
  { ...batch, items: [{ ...item, quantity: 1_000_000_001 }] },
  { ...batch, items: [{ ...item, catalogItemId: "" }] },
  { ...batch, items: [{ ...item, receivingUserId: "receiver" }] },
  { ...batch, ...item }, { ...common, ...item, items: [] },
])("invalid or mixed pending payload blocks admission: %j", input => {
  sessionStorage.setItem(key, JSON.stringify(input))
  expect(() => readPendingMovement(key, "site")).toThrow("Invalid pending movement")
  expect(sessionStorage.getItem(key)).toBe(JSON.stringify(input))
})

test("missing storage is an empty draft but malformed JSON is not discarded", () => {
  expect(readPendingMovement(key, "site")).toBeNull()
  sessionStorage.setItem(key, "invalid-json")
  expect(() => readPendingMovement(key, "site")).toThrow()
  expect(sessionStorage.getItem(key)).toBe("invalid-json")
})