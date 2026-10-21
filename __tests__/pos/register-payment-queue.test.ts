import { enqueueRegisteredCheckout } from "@/app/pos/register/prepare-payment"
import { getActiveRegisterForPayment } from "@/app/pos/register/actions"
import { enqueueCheckout, listOutbox } from "@/app/pos/local/outbox"
import { drainPosOutbox } from "@/app/pos/local/sync-engine"
import { assertRegisterQueueSettled, withRegisterCloseLock } from "@/app/pos/register/queue-guard"
import type { CheckoutOutboxPayload, PosOutboxRow } from "@/app/pos/local/types"

jest.mock("@/app/pos/register/actions", () => ({ getActiveRegisterForPayment: jest.fn() }))
jest.mock("@/app/pos/local/location-permission-state", () => ({
  requirePosPermission: () => ({ generation: 1 }),
  isPosPermissionCurrent: () => true,
}))
jest.mock("@/app/pos/local/outbox", () => ({ enqueueCheckout: jest.fn(), listOutbox: jest.fn() }))
jest.mock("@/app/pos/local/sync-engine", () => ({ drainPosOutbox: jest.fn() }))
const payload: CheckoutOutboxPayload = { siteId: "site", userId: "actor", clientMutationId: "mutation",
  fulfillment: "none", source: "pos", lines: [], payments: [{ method: "cash", amount: 10, tendered: 20, change: 10 }] }
let rows: PosOutboxRow[]
const locks = { request: jest.fn(async (_name, _options, operation) => operation()) }
const row = (data: CheckoutOutboxPayload): PosOutboxRow => ({ id: "row", siteId: "site", kind: "checkout", status: "pending",
  clientMutationId: data.clientMutationId, payload: { kind: "checkout", data }, attempts: 0, createdAt: "", updatedAt: "" })

describe("Register payment queue and closing lock", () => {
  beforeEach(() => {
    jest.clearAllMocks(); rows = []
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
    Object.defineProperty(navigator, "locks", { configurable: true, value: locks })
    jest.mocked(listOutbox).mockImplementation(async () => rows)
    jest.mocked(getActiveRegisterForPayment).mockResolvedValue({ data: { id: "session", location_id: "location" } } as never)
    jest.mocked(enqueueCheckout).mockImplementation(async (_site, data) => {
      const stored = row(data); rows.push(stored); return stored
    })
    jest.mocked(drainPosOutbox).mockImplementation(async () => { rows.forEach((stored) => { stored.status = "synced" }) })
  })
  afterEach(() => { Object.defineProperty(navigator, "onLine", { configurable: true, value: true }) })

  it("tags and confirms collected payments before releasing the lock", async () => {
    const result = await enqueueRegisteredCheckout("site", payload)
    expect(result.status).toBe("synced")
    expect(enqueueCheckout).toHaveBeenCalledWith("site", expect.objectContaining({ registerSessionId: "session", originLocationId: "location",
      payments: [expect.objectContaining({ paymentId: expect.stringMatching(/^[a-f0-9-]{36}$/), amount: 10 })] }))
    expect(locks.request).toHaveBeenCalledWith("pos-register:site", { mode: "exclusive" }, expect.any(Function))
  })
  it("keeps an ambiguous payment and reuses its original mutation/receipt IDs on retry", async () => {
    jest.mocked(drainPosOutbox).mockResolvedValueOnce(undefined)
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
  it("does not collect a changed payment while an earlier receipt is unresolved", async () => {
    jest.mocked(drainPosOutbox).mockResolvedValue(undefined)
    await expect(enqueueRegisteredCheckout("site", payload)).rejects.toThrow("not confirmed")
    await expect(enqueueRegisteredCheckout("site", { ...payload, payments: [{ ...payload.payments![0], amount: 20 }] }))
      .rejects.toThrow("Another payment is unresolved")
    expect(enqueueCheckout).toHaveBeenCalledTimes(1)
  })
  it("recognizes the same attempt if background synchronization finished before the retry", async () => {
    jest.mocked(drainPosOutbox).mockResolvedValueOnce(undefined)
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
})