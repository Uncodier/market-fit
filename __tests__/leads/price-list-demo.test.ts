/** @jest-environment node */

import { createDemoMockClient } from "@/lib/demo-data/mock-client"
import { createClient } from "@/lib/supabase/server"
import { getLeadPriceListOptions } from "@/app/leads/price-list-actions"
import { updateLead } from "@/app/leads/mutation-actions"
import { getLeadById } from "@/app/leads/read-actions"
import { updateDemoLeadPriceList } from "@/app/leads/demo-price-list-actions"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/app/companies/actions", () => ({ findOrCreateCompany: jest.fn() }))

beforeEach(() => jest.clearAllMocks())

it.each(["demo-habituall", "demo-saas-en-123", "demo-ecom-es-456"])(
  "loads, assigns, reloads and clears existing price lists in %s", async (siteId) => {
    const client = createDemoMockClient(siteId)
    jest.mocked(createClient).mockResolvedValue(client)
    const options = await getLeadPriceListOptions(siteId)
    expect(options.error).toBeUndefined()
    expect(options.data.length).toBeGreaterThan(0)
    const list = options.data.find((row) => row.is_active)!
    expect(list).toBeDefined()
    const { data: lead } = await client.from("leads").select("id").eq("site_id", siteId).limit(1).single()
    expect(lead).toBeTruthy()
    const input = { id: lead.id, site_id: siteId, default_price_list_id: list.id }
    expect(await updateLead(input)).toEqual({ success: true })
    expect((await getLeadById(lead.id, siteId)).lead?.default_price_list_id).toBe(list.id)
    expect(await updateLead({ ...input, default_price_list_id: null })).toEqual({ success: true })
    expect((await getLeadById(lead.id, siteId)).lead?.default_price_list_id).toBeNull()
    expect(jest.mocked(createClient).mock.calls.every(([skipDemo]) => !skipDemo)).toBe(true)
  },
)

it("never uses a real database client for demo requests", async () => {
  const from = jest.fn()
  jest.mocked(createClient).mockResolvedValue({ from })
  expect(await getLeadPriceListOptions("demo-habituall")).toHaveProperty("error")
  expect(await updateLead({ id: "lead", site_id: "demo-habituall", default_price_list_id: null })).toHaveProperty("error")
  expect(from).not.toHaveBeenCalled()
})

it("rejects a different demo than the cookie-selected client", async () => {
  jest.mocked(createClient).mockResolvedValue(createDemoMockClient("demo-habituall"))
  expect(await getLeadPriceListOptions("demo-ecom-es-456")).toHaveProperty("error")
  expect(await updateLead({ id: "lead", site_id: "demo-ecom-es-456", default_price_list_id: null })).toHaveProperty("error")
})

it("rejects missing lists, inactive lists and missing leads without changing the assignment", async () => {
  const siteId = "demo-habituall"
  const client = createDemoMockClient(siteId)
  jest.mocked(createClient).mockResolvedValue(client)
  const { data: lead } = await client.from("leads").select("id").eq("site_id", siteId).limit(1).single()
  const input = { id: lead.id, site_id: siteId, default_price_list_id: "missing-list" }
  expect(await updateLead(input)).toHaveProperty("error")
  await client.from("price_lists").insert({ id: "test-inactive", site_id: siteId, is_active: false })
  expect(await updateLead({ ...input, default_price_list_id: "test-inactive" })).toHaveProperty("error")
  expect(await updateLead({ ...input, id: "missing-lead", default_price_list_id: null })).toHaveProperty("error")
  expect((await getLeadById(lead.id, siteId)).lead?.default_price_list_id).toBeNull()
})

it("rejects real or unknown scopes and extra fields at the demo-only boundary", async () => {
  for (const input of [
    { id: "lead", site_id: "11111111-1111-4111-8111-111111111111", default_price_list_id: null },
    { id: "lead", site_id: "demo-unknown", default_price_list_id: null },
    { id: "lead", site_id: "demo-habituall", default_price_list_id: null, user_id: "forged" },
  ]) expect(await updateDemoLeadPriceList(input)).toHaveProperty("error")
  expect(await getLeadPriceListOptions("demo-unknown")).toHaveProperty("error")
  expect(createClient).not.toHaveBeenCalled()
})

it("does not accept the demo client as authorization for a real site", async () => {
  jest.mocked(createClient).mockResolvedValue(createDemoMockClient("demo-habituall"))
  expect(await getLeadPriceListOptions("11111111-1111-4111-8111-111111111111")).toHaveProperty("error")
  expect(await updateLead({
    id: "22222222-2222-4222-8222-222222222222",
    site_id: "11111111-1111-4111-8111-111111111111", default_price_list_id: null,
  })).toHaveProperty("error")
  expect(createClient).toHaveBeenCalledWith(true)
})