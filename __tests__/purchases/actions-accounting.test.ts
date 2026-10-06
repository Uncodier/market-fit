/** @jest-environment node */
import { cookies } from "next/headers"
import { updatePurchase, deletePurchase } from "@/app/purchases/actions"
import { purchaseAmountDue } from "@/app/purchases/purchase-payment-state"
import { createClient } from "@/lib/supabase/server"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { upsertPolizaForPurchase, removePolizaForSource } from "@/app/accounting/ensure"
import { deleteAccountingSource, hasSourceJournal } from '@/app/accounting/source-lifecycle'
jest.mock('@/app/accounting/source-lifecycle', () => ({ deleteAccountingSource: jest.fn(), hasSourceJournal: jest.fn() }))

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/permissions/site-access", () => ({ userCanOnSite: jest.fn() }))
jest.mock("next/headers", () => ({ cookies: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/app/accounting/ensure", () => ({
  upsertPolizaForPurchase: jest.fn(), removePolizaForSource: jest.fn(),
}))

const siteId = "00000000-0000-4000-8000-000000000001"
const id = "00000000-0000-4000-8000-000000000002"
const userId = "00000000-0000-4000-8000-000000000003"
const payment = (amount: number) => ({ id: "pay-1", amount, date: "2026-09-01T00:00:00.000Z", method: "bank" })
const items = (amount: number) => [{ name: "Materials", quantity: 1, unitCost: amount }]
type WriteData = Record<string, unknown>
type QueryResult = { error: { message: string } | null }
type Query = {
  select: jest.Mock; eq: jest.Mock; update: jest.Mock; insert: jest.Mock; delete: jest.Mock; single: jest.Mock
  then: (resolve: (result: QueryResult) => unknown) => Promise<unknown>
}

function setup(overrides = {}) {
  const row = { id, site_id: siteId, amount: 100, amount_due: 100, payments: [] as ReturnType<typeof payment>[], updated_at: "2026-09-01T00:00:00.000Z", accounting_state: "posted", ...overrides }
  const writes: { table: string; operation: string; data: WriteData | null }[] = []
  const errors: Record<string, string> = {}
  const query = (table: string) => {
    let operation = "select"
    const chain: Query = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      update: jest.fn((data) => { operation = "update"; writes.push({ table, operation, data }); return chain }),
      insert: jest.fn((data) => { operation = "insert"; writes.push({ table, operation, data }); return chain }),
      delete: jest.fn(() => { operation = "delete"; writes.push({ table, operation, data: null }); return chain }),
      single: jest.fn(async () => ({ data: row, error: null })),
      then: resolve => {
        const error = errors[`${table}:${operation}`]
        if (!error && table === "purchases" && operation === "update") Object.assign(row, writes.at(-1)?.data)
        return Promise.resolve({ error: error ? { message: error } : null }).then(resolve)
      },
    }
    return chain
  }
  const client = {
    from: jest.fn(query),
    rpc: jest.fn(async (_name: string, params: { p_items: { subtotal: number }[]; p_update: WriteData }) => {
      if (errors.rpc) return { error: { message: errors.rpc, code: errors.code } }
      const amount = params.p_items.reduce((sum, item) => sum + item.subtotal, 0)
      const amountDue = purchaseAmountDue(row, amount)
      Object.assign(row, params.p_update, { amount, amount_due: amountDue, accounting_state: row.accounting_state === "unpublished" ? "unpublished" : "pending" })
      return { error: null }
    }),
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
  }
  jest.mocked(createClient).mockResolvedValue(client)
  jest.mocked(cookies).mockResolvedValue({ get: jest.fn() } as unknown as Awaited<ReturnType<typeof cookies>>)
  jest.mocked(userCanOnSite).mockResolvedValue(true)
  jest.mocked(upsertPolizaForPurchase).mockImplementation(async () => { row.accounting_state = "posted" })
  return { row, writes, errors, client }
}

describe("purchase amount edits", () => {
  beforeEach(() => jest.resetAllMocks())

  it.each([
    [100, 100, [], 160, 160],
    [100, 60, [payment(40)], 160, 120],
    [100, 0, [payment(100)], 60, 0],
    [100, 0, [payment(140)], 160, 20],
    [100, 0, [], 160, 60],
  ])("preserves receipts when total %s and due %s change", async (amount, due, payments, newTotal, expectedDue) => {
    const { row, writes } = setup({ amount, amount_due: due, payments })
    const result = await updatePurchase({ siteId, id, items: items(newTotal as number), amountDue: due as number })
    expect(result.error).toBeNull()
    expect(row.amount_due).toBe(expectedDue)
    expect(row.payments).toEqual(payments)
    expect(writes.filter(write => write.table === "purchases").every(write => write.data?.accounting_state === "pending")).toBe(true)
    expect(upsertPolizaForPurchase).toHaveBeenCalledWith(id, siteId)
  })

  it("retains recorded overpayment when a later edit grows a previously reduced total", async () => {
    const { row } = setup({ amount_due: 0, payments: [payment(100)] })
    await updatePurchase({ siteId, id, items: items(60), amountDue: 0 })
    await updatePurchase({ siteId, id, items: items(130), amountDue: 0 })
    expect(row.amount_due).toBe(30)
    expect(row.payments).toEqual([payment(100)])
  })

  it("requires receipt review rather than losing legacy overpayments on a reduction", async () => {
    const { row, client } = setup({ amount_due: 0, payments: [] })
    const result = await updatePurchase({ siteId, id, items: items(60), amountDue: 0 })
    expect(result.error).toContain("Historical purchase payments require review")
    expect(row.amount).toBe(100)
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it("requires item changes and explicit payment updates to be saved separately", async () => {
    const { row, client } = setup()
    const result = await updatePurchase({ siteId, id, items: items(150), payments: [payment(40)], amountDue: 110 })
    expect(result.error).toBe("Save purchase items and payment changes separately")
    expect(client.rpc).not.toHaveBeenCalled()
    expect(row.amount_due).toBe(100)
    expect(row.payments).toEqual([])
  })

  it("uses positive recorded payments without inventing receipts", () => {
    expect(purchaseAmountDue({ amount: 100, amount_due: 70, payments: [payment(40), payment(-10)] }, 150)).toBe(110)
  })

  it.each([
    { amount: Infinity, amount_due: 0 },
    { amount: 100, amount_due: NaN },
    { amount: 100, amount_due: 100, payments: [payment(NaN)] },
  ])("rejects malformed source payment balances %j", source => {
    expect(() => purchaseAmountDue(source, 150)).toThrow("Invalid purchase payment balance")
  })

  it("rejects inconsistent explicit due rather than inventing a payment", async () => {
    const { writes } = setup()
    const result = await updatePurchase({ siteId, id, payments: [payment(40)], amountDue: 0 })
    expect(result.error).toBe("Amount due does not match the purchase payment update")
    expect(writes).toEqual([])
  })

  it("validates payment-only updates and retains legacy paid balance", async () => {
    const { row } = setup({ amount_due: 70 })
    await updatePurchase({ siteId, id, payments: [payment(20)], amountDue: 50 })
    expect(row.amount_due).toBe(50)
    expect(row.payments).toEqual([payment(20)])
  })

  it.each([-10, NaN, Infinity])("rejects an invalid new payment %s before writing", async amount => {
    const { writes } = setup()
    const result = await updatePurchase({ siteId, id, payments: [payment(amount)] })
    expect(result.error).toBeTruthy()
    expect(writes).toEqual([])
  })

  it.each([-10, NaN, Infinity, 101])("rejects invalid payment balances %s before writing", async amountDue => {
    const { writes } = setup()
    const result = await updatePurchase({ siteId, id, amountDue })
    expect(result.error).toBe("Invalid amount due")
    expect(writes).toEqual([])
  })

  it("leaves the source intact if the atomic item/header update fails", async () => {
    const { writes, row, errors, client } = setup()
    errors.rpc = "insert failed"
    const result = await updatePurchase({ siteId, id, items: items(120) })
    expect(result.error).toContain("The previous purchase was preserved")
    expect(writes).toEqual([])
    expect(row.accounting_state).toBe("posted")
    expect(row.amount).toBe(100)
    expect(client.rpc).toHaveBeenCalledWith("accounting_update_purchase_items", {
      p_site_id: siteId, p_purchase_id: id, p_expected_updated_at: "2026-09-01T00:00:00.000Z",
      p_items: [{ catalog_item_id: null, name: "Materials", quantity: 1, unit_cost: 120, subtotal: 120 }],
      p_update: {},
    })
    expect(upsertPolizaForPurchase).not.toHaveBeenCalled()
  })

  it("requires a reload when another edit changed the purchase version", async () => {
    const { errors } = setup()
    errors.rpc = "version conflict"
    errors.code = "40001"
    expect((await updatePurchase({ siteId, id, items: items(120) })).error).toBe("Purchase changed while editing. Reload and retry.")
  })
  it("saves due date atomically with bill lines and maps it back to detail", async () => {
    const { client } = setup()
    const result = await updatePurchase({ siteId, id, items: items(120), dueDate: "2026-10-15" })
    expect(client.rpc).toHaveBeenCalledWith("accounting_update_purchase_items", expect.objectContaining({ p_update: { due_date: "2026-10-15" } }))
    expect(result.purchase?.dueDate).toBe("2026-10-15")
  })
  it("allows clearing a bill due date without inventing one on omitted updates", async () => {
    const { writes } = setup({ due_date: "2026-10-15" })
    expect((await updatePurchase({ siteId, id, dueDate: null })).purchase?.dueDate).toBeNull()
    await updatePurchase({ siteId, id, notes: "Reviewed" })
    expect(writes.at(-1)?.data).not.toHaveProperty("due_date")
  })
  it("rejects malformed bill due dates without source writes", async () => {
    const { client, writes } = setup()
    expect((await updatePurchase({ siteId, id, items: items(120), dueDate: "2026-02-30" })).error).toContain("valid due date")
    expect(client.rpc).not.toHaveBeenCalled()
    expect(writes).toEqual([])
  })

  it("reports accounting failures without leaving a falsely posted purchase", async () => {
    const { row } = setup()
    jest.mocked(upsertPolizaForPurchase).mockRejectedValueOnce(new Error("RPC failed"))
    const result = await updatePurchase({ siteId, id, notes: "Corrected" })
    expect(result.error).toContain("Purchase saved, but accounting synchronization failed")
    expect(row.accounting_state).toBe("pending")
    expect(row.updated_at).toEqual(expect.any(String))
  })

  it("leaves intentionally unpublished purchases unpublished", async () => {
    const { row } = setup({ accounting_state: "unpublished" })
    await updatePurchase({ siteId, id, items: items(120) })
    expect(row.accounting_state).toBe("unpublished")
    expect(upsertPolizaForPurchase).not.toHaveBeenCalled()
  })

  it("does not issue a separate source delete after an atomic deletion failure", async () => {
    const { writes } = setup()
    jest.mocked(deleteAccountingSource).mockRejectedValueOnce(new Error("Linked refund prevents deletion"))
    const result = await deletePurchase(siteId, id)
    expect(result.error).toBe("Linked refund prevents deletion")
    expect(deleteAccountingSource).toHaveBeenCalledWith(siteId, 'purchase', id)
    expect(removePolizaForSource).not.toHaveBeenCalled()
    expect(writes).toEqual([])
  })

  it('rejects moving a posted purchase to draft before any write or posting', async () => {
    const { writes } = setup()
    expect((await updatePurchase({ siteId, id, status: 'draft' })).error).toContain('cannot return to draft')
    expect(writes).toEqual([])
    expect(upsertPolizaForPurchase).not.toHaveBeenCalled()
  })

  it('repairs an existing journal even when an earlier failure left the source pending', async () => {
    setup({ accounting_state: 'pending' })
    jest.mocked(hasSourceJournal).mockResolvedValueOnce(true)
    await updatePurchase({ siteId, id, notes: 'Reviewed' })
    expect(upsertPolizaForPurchase).toHaveBeenCalledWith(id, siteId)
  })

  it("rejects unauthenticated updates before any source read or write", async () => {
    const { client } = setup()
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await updatePurchase({ siteId, id, items: items(120) })).error).toBe("Not authenticated")
    expect(client.from).not.toHaveBeenCalled()
  })
})