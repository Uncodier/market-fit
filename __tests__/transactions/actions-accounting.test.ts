/** @jest-environment node */
import { updateExpense, deleteExpense } from "@/app/transactions/actions"
import { createClient } from "@/lib/supabase/server"
import { upsertPolizaForExpense, removePolizaForSource } from "@/app/accounting/ensure"
import { deleteAccountingSource, hasSourceJournal } from '@/app/accounting/source-lifecycle'
jest.mock('@/app/accounting/source-lifecycle', () => ({ deleteAccountingSource: jest.fn(), hasSourceJournal: jest.fn() }))

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/app/campaigns/actions/transactions/updateCampaignCosts", () => ({ updateCampaignCosts: jest.fn() }))
jest.mock("@/app/accounting/ensure", () => ({ upsertPolizaForExpense: jest.fn(), removePolizaForSource: jest.fn() }))

const id = "00000000-0000-4000-8000-000000000001"
const siteId = "00000000-0000-4000-8000-000000000002"

function setup(state = "posted") {
  const row: any = { id, site_id: siteId, amount: 50, campaign_id: null, accounting_state: state }
  const writes: any[] = []
  const transactions: any = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    update: jest.fn((data) => { writes.push(data); Object.assign(row, data); return transactions }),
    delete: jest.fn().mockReturnThis(), single: jest.fn(async () => ({ data: { ...row }, error: null })),
  }
  const sites: any = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { user_id: "user-1" } }) }
  const client = {
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" } } } }) },
    from: jest.fn(table => table === "sites" ? sites : transactions),
  }
  jest.mocked(createClient).mockResolvedValue(client as any)
  return { row, writes, transactions, sites, client }
}

describe("expense accounting synchronization", () => {
  beforeEach(() => jest.resetAllMocks())

  it("saves a posted expense as pending and synchronizes the new source", async () => {
    const { writes, transactions } = setup()
    const result = await updateExpense(id, { siteId, amount: 80, date: "2026-09-02", category: "Materials" })
    expect(writes).toEqual([{ amount: 80, date: "2026-09-02", category: "Materials", accounting_state: "pending", updated_at: expect.any(String) }])
    expect(transactions.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(upsertPolizaForExpense).toHaveBeenCalledWith(id, siteId)
    expect(result.data.accounting_state).toBe("posted")
    expect(result.error).toBeNull()
  })

  it("returns a saved-but-pending error on journal failure", async () => {
    const { row } = setup()
    jest.mocked(upsertPolizaForExpense).mockRejectedValueOnce(new Error("Posting unavailable"))
    const result = await updateExpense(id, { siteId, amount: 75 })
    expect(result.error).toContain("Expense saved, but accounting synchronization failed")
    expect(row.accounting_state).toBe("pending")
    expect(result.data.accounting_state).toBe("pending")
    expect(row.amount).toBe(75)
  })

  it.each(["pending", "unpublished"])("does not publish a %s expense during ordinary edits", async state => {
    const { writes } = setup(state)
    await updateExpense(id, { siteId, amount: 80 })
    expect(writes[0]).not.toHaveProperty("accounting_state")
    expect(upsertPolizaForExpense).not.toHaveBeenCalled()
  })

  it("does not delete a source if atomic journal removal fails", async () => {
    const { transactions } = setup()
    jest.mocked(deleteAccountingSource).mockRejectedValueOnce(new Error("Removal failed"))
    const result = await deleteExpense(id, siteId)
    expect(result).toEqual({ success: false, error: "Removal failed" })
    expect(transactions.delete).not.toHaveBeenCalled()
  })

  it("delegates source and journal deletion to one atomic operation", async () => {
    const { transactions } = setup()
    const result = await deleteExpense(id, siteId)
    expect(deleteAccountingSource).toHaveBeenCalledWith(siteId, 'expense', id)
    expect(result).toEqual({ success: true, error: null })
    expect(removePolizaForSource).not.toHaveBeenCalled()
    expect(transactions.delete).not.toHaveBeenCalled()
    expect(transactions.eq).toHaveBeenCalledWith("site_id", siteId)
  })

  it('reposts an existing pending journal on subsequent edits', async () => {
    setup('pending')
    jest.mocked(hasSourceJournal).mockResolvedValueOnce(true)
    await updateExpense(id, { siteId, amount: 80 })
    expect(upsertPolizaForExpense).toHaveBeenCalledWith(id, siteId)
  })

  it("denies foreign sites before accessing an expense", async () => {
    const { sites, transactions } = setup()
    sites.single.mockResolvedValue({ data: { user_id: "other-user", site_members: [] } })
    expect((await updateExpense(id, { siteId, amount: 80 })).error).toBe("Not authorized for this site")
    expect(transactions.select).not.toHaveBeenCalled()
    expect(upsertPolizaForExpense).not.toHaveBeenCalled()
  })
})