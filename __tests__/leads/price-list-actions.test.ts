/** @jest-environment node */

import { createClient } from "@/lib/supabase/server"
import { getLeadPriceListOptions } from "@/app/leads/price-list-actions"
import { updateLead } from "@/app/leads/mutation-actions"
import { getLeadById } from "@/app/leads/read-actions"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/app/companies/actions", () => ({ findOrCreateCompany: jest.fn() }))

const id = "11111111-1111-4111-8111-111111111111"
const site_id = "22222222-2222-4222-8222-222222222222"
const listId = "33333333-3333-4333-8333-333333333333"
const input = { id, site_id, default_price_list_id: listId }
const getUser = jest.fn()
const rpc = jest.fn()
const lead = { select: jest.fn(), update: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn(), single: jest.fn() }
const lists = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), range: jest.fn(), maybeSingle: jest.fn() }
const from = jest.fn()

beforeEach(() => {
  jest.resetAllMocks()
  from.mockImplementation((table) => table === "leads" ? lead : lists)
  for (const fn of [lead.select, lead.update, lead.eq]) fn.mockReturnValue(lead)
  for (const fn of [lists.select, lists.eq, lists.order]) fn.mockReturnValue(lists)
  lists.maybeSingle.mockResolvedValue({ data: { id: listId }, error: null })
  lists.range.mockResolvedValue({ data: [], error: null })
  lead.maybeSingle.mockResolvedValue({ data: { id }, error: null })
  getUser.mockResolvedValue({ data: { user: { id: "actor" } }, error: null })
  rpc.mockResolvedValue({ data: true, error: null })
  jest.mocked(createClient).mockResolvedValue({ from, rpc, auth: { getUser } } as never)
})

it("saves an active same-site list through user RLS and update permission", async () => {
  expect(await updateLead(input)).toEqual({ success: true })
  expect(createClient).toHaveBeenCalledWith(true)
  expect(rpc).toHaveBeenCalledWith("user_can", { p_site_id: site_id, p_command: "update" })
  expect(lists.eq.mock.calls).toEqual([["id", listId], ["site_id", site_id], ["is_active", true]])
  expect(lead.update).toHaveBeenCalledWith({ default_price_list_id: listId })
  expect(lead.eq.mock.calls).toEqual([["id", id], ["site_id", site_id]])
})

it("clears the assignment without requiring the old list to remain active", async () => {
  expect(await updateLead({ ...input, default_price_list_id: null })).toEqual({ success: true })
  expect(lists.select).not.toHaveBeenCalled()
  expect(lead.update).toHaveBeenCalledWith({ default_price_list_id: null })
})

it("rejects malformed list IDs before any queries or writes", async () => {
  expect(await updateLead({ ...input, default_price_list_id: "bad" })).toHaveProperty("error")
  expect(from).not.toHaveBeenCalled()
})

it("rejects unauthenticated assignments", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  expect(await updateLead(input)).toHaveProperty("error")
  expect(from).not.toHaveBeenCalled()
})

it.each([{ data: false, error: null }, { data: true, error: { message: "private" } }])(
  "fails closed on denied/unavailable site permissions", async (permission) => {
    rpc.mockResolvedValue(permission)
    expect(await updateLead(input)).toHaveProperty("error", expect.stringContaining("permission"))
    expect(from).not.toHaveBeenCalled()
  },
)

it.each([
  { data: null, error: null }, { data: null, error: { message: "private" } },
])("rejects inactive, cross-site, missing or unreadable lists", async (result) => {
  lists.maybeSingle.mockResolvedValue(result)
  expect(await updateLead(input)).toEqual({ error: "Select an active price list from this site." })
  expect(lead.update).not.toHaveBeenCalled()
})

it("does not claim a missing or cross-site lead was updated", async () => {
  lead.maybeSingle.mockResolvedValue({ data: null, error: null })
  expect(await updateLead(input)).toEqual({ error: "Lead not found or access denied." })
})

it("redacts write errors and never retries the write", async () => {
  lead.maybeSingle.mockResolvedValue({ data: null, error: { message: "private" } })
  const result = await updateLead(input)
  expect(result.error).toContain("Could not save")
  expect(result.error).not.toContain("private")
  expect(lead.update).toHaveBeenCalledTimes(1)
})

it("loads the saved assignment on lead reload", async () => {
  lead.single.mockResolvedValue({ data: input, error: null })
  expect((await getLeadById(id, site_id)).lead).toMatchObject(input)
  expect(lead.select.mock.calls[0][0]).toContain("default_price_list_id")
})

it("pages options including inactive labels within the authorized site", async () => {
  const first = Array.from({ length: 500 }, (_, index) => ({ id: String(index), name: "List", currency: "USD", is_active: true }))
  const last = { id: listId, name: "Legacy", currency: "USD", is_active: false }
  lists.range.mockResolvedValueOnce({ data: first, error: null }).mockResolvedValueOnce({ data: [last], error: null })
  expect((await getLeadPriceListOptions(site_id)).data).toEqual([...first, last])
  expect(lists.range.mock.calls).toEqual([[0, 499], [500, 999]])
  expect(lists.eq).toHaveBeenCalledWith("site_id", site_id)
  expect(rpc).toHaveBeenCalledWith("user_can", { p_site_id: site_id, p_command: "select" })
})

it("rejects invalid option scopes without accessing the database", async () => {
  expect(await getLeadPriceListOptions("bad")).toHaveProperty("error")
  expect(createClient).not.toHaveBeenCalled()
})

it("does not expose options without authentication or site permission", async () => {
  getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
  expect(await getLeadPriceListOptions(site_id)).toHaveProperty("error")
  rpc.mockResolvedValue({ data: false, error: null })
  expect(await getLeadPriceListOptions(site_id)).toHaveProperty("error")
  expect(from).not.toHaveBeenCalled()
})

it("distinguishes option loading failures from an empty list", async () => {
  lists.range.mockResolvedValue({ data: null, error: { message: "private" } })
  expect(await getLeadPriceListOptions(site_id)).toEqual({ data: [], error: "Could not load price lists." })
})