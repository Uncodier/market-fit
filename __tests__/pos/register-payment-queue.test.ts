import { enqueueRegisteredCheckout } from "@/app/pos/register/prepare-payment"
import { getActiveRegisterForPayment } from "@/app/pos/register/actions"
import { enqueueCheckout, listOutbox } from "@/app/pos/local/outbox"
import { drainPosOutbox, syncPosCheckout } from "@/app/pos/local/sync-engine"
import { resetCheckoutCartSession } from "@/app/pos/local/checkout-attempt-storage"
import { assertRegisterQueueSettled, withRegisterCloseLock } from "@/app/pos/register/queue-guard"
import type { CheckoutOutboxPayload, PosOutboxRow } from "@/app/pos/local/types"

jest.mock("@/app/pos/register/actions", () => ({ getActiveRegisterForPayment: jest.fn() }))
jest.mock("@/app/pos/local/location-permission-state", () => ({
  requirePosPermission: () => ({ generation: 1 }),
  isPosPermissionCurrent: () => true,
}))
jest.mock("@/app/pos/local/outbox", () => ({ enqueueCheckout: jest.fn(), listOutbox: jest.fn() }))
jest.mock("@/app/pos/local/sync-engine", () => ({ drainPosOutbox: jest.fn(), syncPosCheckout: jest.fn() }))
const payload: CheckoutOutboxPayload = { siteId: "site", userId: "actor", clientMutationId: "mutation",
  fulfillment: "none", source: "pos", lines: [], payments: [{ method: "cash", amount: 10, tendered: 20, change: 10 }] }
let rows: PosOutboxRow[]
const locks = { request: jest.fn(async (_name, _options, operation) => operation()) }
const row = (data: CheckoutOutboxPayload): PosOutboxRow => ({ id: "row", siteId: "site", kind: "checkout", status: "pending",
  clientMutationId: data.clientMutationId, payload: { kind: "checkout", data }, attempts: 0, createdAt: "", updatedAt: "" })

describe("Register payment queue and closing lock", () => {
  beforeEach(() => {
    jest.clearAllMocks(); rows = []; localStorage.clear()
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
    Object.defineProperty(navigator, "locks", { configurable: true, value: locks })
    jest.mocked(listOutbox).mockImplementation(async () => rows)
    jest.mocked(getActiveRegisterForPayment).mockResolvedValue({ data: { id: "session", location_id: "location" } } as never)
    jest.mocked(enqueueCheckout).mockImplementation(async (_site, data, checkoutCartSessionId) => {
      const stored = { ...row(data), checkoutCartSessionId }; rows.push(stored); return stored
    })
    jest.mocked(drainPosOutbox).mockResolvedValue(undefined)
    jest.mocked(syncPosCheckout).mockImplementation(async (_site, id) => {
      rows.filter((stored) => stored.clientMutationId === id).forEach((stored) => { stored.status = "synced" })
    })
  })
  afterEach(() => { Object.defineProperty(navigator, "onLine", { configurable: true, value: true }) })

  it("tags and confirms collected payments before releasing the lock", async () => {
    const result = await enqueueRegisteredCheckout("site", payload)
    expect(result.status).toBe("synced")
    expect(enqueueCheckout).toHaveBeenCalledWith("site", expect.objectContaining({ registerSessionId: "session", originLocationId: "location",
      payments: [expect.objectContaining({ paymentId: expect.stringMatching(/^[a-f0-9-]{36}$/), amount: 10 })] }), expect.any(String))
    expect(syncPosCheckout).toHaveBeenCalledWith("site", "mutation")
    expect(drainPosOutbox).not.toHaveBeenCalled()
    expect(locks.request).toHaveBeenCalledWith("pos-register:site", { mode: "exclusive" }, expect.any(Function))
  })
  it("keeps an ambiguous payment and reuses its original mutation/receipt IDs on retry", async () => {
    jest.mocked(syncPosCheckout).mockResolvedValueOnce(undefined)
    await expect(enqueueRegisteredCheckout("site", payload)).rejects.toThrow("not confirmed")
    const original = rows[0].payload
    await enqueueRegisteredCheckout("site", { ...payload, clientMutationId: "new-click" })
    expect(enqueueCheckout).toHaveBeenCalledTimes(1)
    expect(getActiveRegisterForPayment).toHaveBeenCalledTimes(1)
    expect(rows[0].payload).toBe(original)
  })
  it("does not invent a session or clear a payment when lookup fails", async () => {
    jest.mocked(getActiveRegisterForPayment).mockResolvedValue({ error: "Open a register first" })
    await expect(enqueueRegisteredCheckout("site", payload)).rejects.toThrow("Open a register first")
    expect(enqueueCheckout).not.toHaveBeenCalled()
  })
  it("does not enqueue a stale confirmation after New Order during register lookup", async () => {
    jest.mocked(getActiveRegisterForPayment).mockImplementationOnce(async () => {
      resetCheckoutCartSession("site")
      return { data: { id: "session", location_id: "location" } } as never
    })
    await expect(enqueueRegisteredCheckout("site", payload)).rejects.toThrow("active cart changed")
    expect(enqueueCheckout).not.toHaveBeenCalled()
  })
  it("does not collect a changed payment while an earlier receipt is unresolved", async () => {
    jest.mocked(syncPosCheckout).mockResolvedValueOnce(undefined)
    await expect(enqueueRegisteredCheckout("site", payload)).rejects.toThrow("not confirmed")
    await expect(enqueueRegisteredCheckout("site", { ...payload, payments: [{ ...payload.payments![0], amount: 20 }] }))
      .rejects.toThrow("This order has an unresolved")
    expect(enqueueCheckout).toHaveBeenCalledTimes(1)
  })
  it("recognizes the same attempt if background synchronization finished before the retry", async () => {
    jest.mocked(syncPosCheckout).mockResolvedValueOnce(undefined)
    await expect(enqueueRegisteredCheckout("site", payload)).rejects.toThrow("not confirmed")
    rows[0].status = "synced"
    await expect(enqueueRegisteredCheckout("site", payload)).resolves.toBe(rows[0])
    expect(enqueueCheckout).toHaveBeenCalledTimes(1)
    expect(getActiveRegisterForPayment).toHaveBeenCalledTimes(1)
  })
  it("allows unpaid order sends offline but refuses collected receipts offline", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false })
    await enqueueRegisteredCheckout("site", { ...payload, payments: [] })
    await expect(enqueueRegisteredCheckout("site", payload)).rejects.toThrow("Connect")
    expect(getActiveRegisterForPayment).not.toHaveBeenCalled()
  })
  it("blocks closing for failed, pending or syncing receipts, never for unpaid sends", async () => {
    jest.mocked(drainPosOutbox).mockResolvedValue(undefined)
    const close = jest.fn()
    for (const status of ["failed", "pending", "syncing"] as const) {
      rows = [{ ...row(payload), status }]
      await expect(withRegisterCloseLock("site", close)).rejects.toThrow("unsynchronized payments")
    }
    expect(close).not.toHaveBeenCalled()
    rows = [row({ ...payload, payments: [] })]
    await assertRegisterQueueSettled("site")
    await withRegisterCloseLock("site", close)
    expect(close).toHaveBeenCalledTimes(1)
  })
  it("fails closed on IndexedDB errors or unsupported browser locking", async () => {
    jest.mocked(listOutbox).mockRejectedValueOnce(new Error("Storage unavailable"))
    await expect(withRegisterCloseLock("site", jest.fn())).rejects.toThrow("Storage unavailable")
    Object.defineProperty(navigator, "locks", { configurable: true, value: undefined })
    await expect(enqueueRegisteredCheckout("site", payload)).rejects.toThrow("safe register locking")
  })
  it("isolates a verified receipt to its order but still blocks register closing", async () => {
    const old = { ...row({ ...payload, existingOrderId: "old-order", registerSessionId: "session" }),
      status: "failed" as const, recoveryState: "payment_recorded" as const,
      recoveryOrderId: "old-order", recoveryMessage: "Payment recorded; review required" }
    rows = [old]
    await expect(enqueueRegisteredCheckout("site", { ...payload, existingOrderId: "old-order", clientMutationId: "changed",
      payments: [{ method: "cash", amount: 20 }] })).rejects.toThrow("This order has an unresolved")
    await expect(enqueueRegisteredCheckout("site", { ...payload, existingOrderId: "other-order", clientMutationId: "new-order" }))
      .resolves.toMatchObject({ status: "synced" })
    expect(old.status).toBe("failed")
    await expect(withRegisterCloseLock("site", jest.fn())).rejects.toThrow("unsynchronized payments")
  })
  it("retains a rejected attempt but uses new identities for its reviewed reattempt", async () => {
    const rejected = { ...row(payload), status: "failed" as const, recoveryState: "rejected" as const }
    rows = [rejected]
    const adopt = jest.fn()
    const result = await enqueueRegisteredCheckout("site", payload, adopt)
    expect(result.clientMutationId).not.toBe(rejected.clientMutationId)
    expect(adopt).toHaveBeenCalledWith(result.clientMutationId)
    expect(rows).toHaveLength(2)
    expect(rejected.status).toBe("failed")
    await expect(assertRegisterQueueSettled("site")).resolves.toBeUndefined()
  })
  it.each(["failed", "pending", "syncing"] as const)("allows another order while a %s payment remains unverified", async (status) => {
    const old = { ...row({ ...payload, clientMutationId: "old-attempt", existingOrderId: "old" }), status, recoveryState: "review_required" as const }
    rows = [old]
    await expect(enqueueRegisteredCheckout("site", { ...payload, existingOrderId: "other" })).resolves.toMatchObject({ status: "synced" })
    expect(old.status).toBe(status)
    expect(old.recoveryState).toBe("review_required")
    await expect(enqueueRegisteredCheckout("site", { ...payload, clientMutationId: "retry-old", existingOrderId: "old", payments: [{ method: "cash", amount: 11 }] }))
      .rejects.toThrow("This order has an unresolved")
    await expect(withRegisterCloseLock("site", jest.fn())).rejects.toThrow("unsynchronized payments")
  })
  it("allows a distinct new-order attempt with an identical cart after the old receipt is isolated", async () => {
    const old = { ...row({ ...payload, registerSessionId: "session", originLocationId: "location" }),
      status: "failed" as const, recoveryState: "payment_recorded" as const, recoveryOrderId: "old-order" }
    rows = [old]
    resetCheckoutCartSession("site")
    await expect(enqueueRegisteredCheckout("site", { ...payload, clientMutationId: "distinct-new-cart-session" }))
      .resolves.toMatchObject({ status: "synced", clientMutationId: "distinct-new-cart-session" })
    expect(enqueueCheckout).toHaveBeenCalledTimes(1)
    expect(old.status).toBe("failed")
  })
  it("keeps a changed new-order attempt fenced until a deliberate New Order", async () => {
    jest.mocked(syncPosCheckout).mockResolvedValueOnce(undefined)
    await expect(enqueueRegisteredCheckout("site", payload)).rejects.toThrow("not confirmed")
    const old = rows[0]
    const original = JSON.parse(JSON.stringify(old.payload))
    await expect(enqueueRegisteredCheckout("site", { ...payload, clientMutationId: "changed", payments: [{ method: "cash", amount: 11 }] }))
      .rejects.toThrow("This order has an unresolved")
    resetCheckoutCartSession("site")
    await expect(enqueueRegisteredCheckout("site", { ...payload, clientMutationId: "next-customer" }))
      .resolves.toMatchObject({ status: "synced", clientMutationId: "next-customer" })
    expect(rows).toHaveLength(2)
    expect(old.status).toBe("pending")
    expect(old.payload).toEqual(original)
  })
  it("does not mistake an identical fresh basket for an untagged legacy payment", async () => {
    const legacy = { ...row(payload), status: "failed" as const, recoveryState: "review_required" as const }
    rows = [legacy]
    resetCheckoutCartSession("site")
    await expect(enqueueRegisteredCheckout("site", { ...payload, clientMutationId: "next-customer" }))
      .resolves.toMatchObject({ status: "synced", clientMutationId: "next-customer" })
    expect(legacy.status).toBe("failed")
  })
})