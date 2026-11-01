import { getDeals } from "@/app/deals/actions"
import { createClient } from "@/lib/supabase/client"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/companies/actions", () => ({ findOrCreateCompany: jest.fn() }))

const order = jest.fn()
const eq = jest.fn(() => ({ order }))
const select = jest.fn(() => ({ eq }))
const from = jest.fn(() => ({ select }))

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>)
})

it("returns empty only for a successful empty query scoped to the site", async () => {
  order.mockResolvedValueOnce({ data: [], error: null, status: 200 })
  expect(await getDeals("site-a")).toEqual({ deals: [], error: null })
  expect(from).toHaveBeenCalledWith("deals")
  expect(eq).toHaveBeenCalledWith("site_id", "site-a")
})

it.each([[401, "PGRST301"], [403, "42501"], [404, "42P01"], [503, "PGRST000"]])(
  "preserves status %s and code %s without leaking raw database details", async (status, code) => {
    order.mockResolvedValueOnce({ data: null, error: { message: "Private details", code }, status })
    expect(await getDeals("site-a")).toEqual({ deals: null, error: "Failed to fetch deals", status, code })
  },
)

it("does not report a null payload as empty", async () => {
  order.mockResolvedValueOnce({ data: null, error: null, status: 200 })
  expect(await getDeals("site-a")).toEqual({ deals: null, error: "Failed to fetch deals", status: 200 })
})

it("preserves metadata from thrown errors", async () => {
  order.mockRejectedValueOnce(Object.assign(new Error("Private details"), { status: 401, code: "PGRST301" }))
  expect(await getDeals("site-a")).toEqual({ deals: null, error: "Failed to fetch deals", status: 401, code: "PGRST301" })
})

it.each([null, "Network failed", { status: "401", code: {} }])("handles unexpected thrown values safely: %j", async error => {
  order.mockRejectedValueOnce(error)
  expect(await getDeals("site-a")).toEqual({ deals: null, error: "Failed to fetch deals" })
})