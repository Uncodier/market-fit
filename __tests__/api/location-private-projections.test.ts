/** @jest-environment node */
import { NextRequest } from "next/server"
import { proxyFinderRequest } from "@/app/api/finder/[...path]/proxy-finder-request"
import { GET as exportLeads } from "@/app/api/leads/export/route"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { createClient } from "@/lib/supabase/server"
import { createServiceApiClient } from "@/lib/supabase/server-client"
import { acquireSemaphore, checkRateLimit } from "@/lib/redis/control-plane"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/supabase/server-client", () => ({ createServiceApiClient: jest.fn() }))
jest.mock("@/lib/redis/control-plane", () => ({
  acquireSemaphore: jest.fn(), releaseSemaphore: jest.fn(), hashRedisKeyPart: jest.fn(async (v: string) => v),
  checkRateLimit: jest.fn(async () => ({ allowed: true })), rateLimitError: jest.fn(),
}))
jest.mock("@/lib/redis/upstash-rest", () => ({ isRedisConfigured: () => true }))

const site = "00000000-0000-4000-8000-000000000001"
const rpc = jest.fn(), getSession = jest.fn()
const headers = { cookie: "sb-test=session" }

beforeEach(() => {
  jest.clearAllMocks()
  rpc.mockImplementation(async name => ({ data: name === "current_user_site_role" ? "collaborator" : true, error: null }))
  jest.mocked(createClient).mockResolvedValue({ rpc, auth: {
    getUser: jest.fn(async () => ({ data: { user: { id: "actor" } }, error: null })), getSession,
  } } as never)
})

it.each([true, null, "false"])("denies Finder before forwarding a token or external search when scope is %p", async state => {
  rpc.mockImplementation(async name => ({ data: name === "current_user_site_role" ? "collaborator" : state, error: null }))
  const request = new Request(`https://app.test/api/finder/autocomplete/industries?site_id=${site}&q=shop&page=1`, { headers })
  expect((await proxyFinderRequest(request, ["autocomplete", "industries"])).status).toBe(403)
  expect(getSession).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it("denies private lead exports before service clients and semaphore/cache access", async () => {
  const response = await exportLeads(new NextRequest(`https://app.test/api/leads/export?siteId=${site}`, { headers }))
  expect(response.status).toBe(403)
  expect(createServiceApiClient).not.toHaveBeenCalled()
  expect(acquireSemaphore).not.toHaveBeenCalled()
})

it("denies direct analytics before rate/cache admission after a permission change", async () => {
  const request = new Request(`https://app.test/api/revenue?siteId=${site}&startDate=2026-10-01&endDate=2026-10-02`, { headers })
  rpc.mockImplementation(async name => ({ data: name === "current_user_site_role" ? "collaborator" : false, error: null }))
  expect((await requireAnalyticsAccess(request)).error).toBeUndefined()
  jest.mocked(checkRateLimit).mockClear()
  rpc.mockImplementation(async name => ({ data: name === "current_user_site_role" ? "collaborator" : true, error: null }))
  expect((await requireAnalyticsAccess(request)).error?.status).toBe(403)
  expect(checkRateLimit).not.toHaveBeenCalled()
})