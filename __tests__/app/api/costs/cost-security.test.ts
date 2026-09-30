/** @jest-environment node */
import { NextRequest } from "next/server"
import { GET } from "@/app/api/costs/route"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { createClient as legacyClient } from "@/utils/supabase/server"
import { costClient, costRequest, SITE, OTHER_SITE, SEGMENT, CAMPAIGN, transaction } from "./cost-test-client"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock("@/utils/supabase/server", () => ({ createClient: jest.fn() }))

beforeEach(() => jest.clearAllMocks())

it("rejects absent credentials without opening a data client", async () => {
  expect((await GET(costRequest({}, false))).status).toBe(401)
  expect(createClient).not.toHaveBeenCalled()
})

it("rejects unverified users before any financial query", async () => {
  const client = costClient()
  client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
  jest.mocked(createClient).mockResolvedValue(client)
  expect((await GET(costRequest())).status).toBe(401)
  expect(client.rpc).not.toHaveBeenCalled()
  expect(client.from).not.toHaveBeenCalled()
})

it.each([null, "provider-error"])("denies another site's data on missing/failed membership (%s)", async (error) => {
  const client = costClient()
  client.rpc.mockResolvedValue({ data: null, error })
  jest.mocked(createClient).mockResolvedValue(client)
  expect((await GET(costRequest({ siteId: OTHER_SITE, userId: "forged-user" }))).status).toBe(403)
  expect(client.rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: OTHER_SITE })
  expect(client.from).not.toHaveBeenCalled()
})

it("reuses only the verified user client and scopes every financial query to the site", async () => {
  const client = costClient({ transactions: [transaction("a"), transaction("b", "2026-08-31", { site_id: OTHER_SITE })] })
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(costRequest())
  expect(response.status).toBe(200)
  expect((await response.json()).totalCosts.actual).toBe(10)
  expect(createClient).toHaveBeenCalledTimes(1)
  expect(createClient).toHaveBeenCalledWith(true)
  expect(createServiceClient).not.toHaveBeenCalled()
  expect(legacyClient).not.toHaveBeenCalled()
  expect(client.queries.every((q) => q.filters.some((f) => f.column === "site_id" && f.value === SITE))).toBe(true)
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
})

it.each([
  { siteId: "default" }, { siteId: "" }, { segmentId: "bad,or(id.eq.x)" }, { campaignId: "bad" },
  { segmentId: "" }, { campaignId: "" }, { startDate: "not-a-date" }, { startDate: "2026-02-30" },
  { endDate: "2026-02-29" }, { startDate: "2026-08-32" }, { startDate: "08/01/2026" },
  { startDate: "2026-08-01T24:00:00Z" }, { startDate: "2026-08-01T00:00:00" },
  { startDate: "2026-08-01T00:00:00+25:00" }, { startDate: "" },
  { startDate: "2026-09-01" }, { startDate: "2020-01-01" }, { endDate: "9999-12-31", startDate: "9999-12-31" },
])("rejects invalid IDs/dates before access: %j", async (values) => {
  const response = await GET(costRequest(values))
  expect(response.status).toBe(400)
  expect(createClient).not.toHaveBeenCalled()
})

it("rejects duplicate filters", async () => {
  const response = await GET(new NextRequest(`${costRequest().url}&siteId=${OTHER_SITE}`))
  expect(response.status).toBe(400)
  expect(createClient).not.toHaveBeenCalled()
})

it.each([{ segmentId: SEGMENT }, { campaignId: CAMPAIGN }])("rejects cross-site filters: %j", async (filter) => {
  const client = costClient({
    segments: [{ id: SEGMENT, site_id: OTHER_SITE }], campaigns: [{ id: CAMPAIGN, site_id: OTHER_SITE }],
  })
  jest.mocked(createClient).mockResolvedValue(client)
  const response = await GET(costRequest(filter))
  expect(response.status).toBe(403)
  expect(client.from).not.toHaveBeenCalledWith("transactions")
})