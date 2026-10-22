import { act, cleanup, render } from "@testing-library/react"
import { randomBytes } from "node:crypto"
import { createClient as createSdkClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { fetchBadgeCount, type BadgeResource } from "@/app/components/navigation/badge-count-queries"
import { ChatsBadge } from "@/app/components/navigation/ChatsBadge"
import { LeadsBadge } from "@/app/components/navigation/LeadsBadge"
import { ControlCenterBadge } from "@/app/components/navigation/ControlCenterBadge"
import { ContentBadge } from "@/app/components/navigation/ContentBadge"
import { RequirementsBadge, CampaignsBadge } from "@/app/components/navigation/RequirementsBadge"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-a" }, isLoading: false }) }))
jest.mock("@/app/components/auth/auth-context", () => ({ useAuthContext: () => ({ user: { id: "user-a" }, isLoading: false }) }))

const makeClient = jest.mocked(createClient)
let response: { count: number | null; data: Array<{ id: string; company_id: string | null }> | null; error: { message: string } | null }
let builder: {
  select: jest.Mock
  eq: jest.Mock
  abortSignal: jest.Mock
  then: (resolve: (value: typeof response) => unknown, reject?: (error: unknown) => unknown) => Promise<unknown>
}
let from: jest.Mock

beforeEach(() => {
  jest.useFakeTimers()
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
  response = { count: 7, data: [{ id: "row-1", company_id: null }], error: null }
  builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    abortSignal: jest.fn(() => builder),
    then: (resolve, reject) => Promise.resolve(response).then(resolve, reject),
  }
  from = jest.fn(() => builder)
  makeClient.mockReturnValue({ from } as unknown as ReturnType<typeof createClient>)
})

afterEach(() => {
  cleanup()
  jest.runAllTicks()
  expect(jest.getTimerCount()).toBe(0)
  jest.useRealTimers()
  jest.restoreAllMocks()
})

test.each([
  [ChatsBadge, "chats", "conversations", "pending"],
  [ControlCenterBadge, "tasks", "tasks", "pending"],
  [ContentBadge, "content", "content", "review"],
  [RequirementsBadge, "requirements", "requirements", "on-review"],
  [CampaignsBadge, "campaigns", "campaigns", "pending"],
] as const)("renders %s from an exact HEAD status total, not returned/capped rows", async (Component, resource, table, status) => {
  const { container } = render(<Component isActive />)
  await act(async () => { await Promise.resolve() })
  expect(container.textContent).toBe("7")
  expect(from).toHaveBeenCalledWith(table)
  expect(builder.select).toHaveBeenCalledWith("id", { head: true, count: "exact" })
  expect(builder.eq).toHaveBeenCalledWith("site_id", "site-a")
  expect(builder.eq).toHaveBeenCalledWith("status", status)
  if (resource === "chats") expect(builder.eq).toHaveBeenCalledWith("is_archived", false)
  expect(builder.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal))
})

test("LeadsBadge groups repeated company IDs; every company-less lead remains distinct", async () => {
  response.data = [
    { id: "1", company_id: "company-a" },
    { id: "2", company_id: "company-a" },
    { id: "3", company_id: "company-b" },
    { id: "4", company_id: null },
    { id: "5", company_id: null },
  ]
  response.count = 50_000
  const { container } = render(<LeadsBadge />)
  await act(async () => { await Promise.resolve() })
  expect(container.textContent).toBe("4")
  expect(builder.select).toHaveBeenCalledWith("id, company_id")
  expect(builder.eq).toHaveBeenCalledWith("status", "new")
})

test.each([ChatsBadge, LeadsBadge, ControlCenterBadge, ContentBadge, RequirementsBadge, CampaignsBadge])("%s hides zero and preserves 99+ cap", async Component => {
  response.count = 0
  response.data = []
  const { container, unmount } = render(<Component />)
  await act(async () => { await Promise.resolve() })
  expect(container).toBeEmptyDOMElement()
  unmount()
  response.count = 1_001
  response.data = Array.from({ length: 101 }, (_, index) => ({ id: String(index), company_id: null }))
  const second = render(<Component />)
  await act(async () => { await Promise.resolve() })
  expect(second.container.textContent).toBe("99+")
})

test.each(["chats", "leads", "tasks", "content", "requirements", "campaigns"] as BadgeResource[])("%s propagates SDK errors to polling backoff", async resource => {
  response.error = { message: "synthetic unavailable" }
  await expect(fetchBadgeCount(resource, "site-a", new AbortController().signal)).rejects.toEqual(response.error)
})

test("legacy demo builder without cancellation remains supported", async () => {
  makeClient.mockReturnValue({ from, _isMock: true } as unknown as ReturnType<typeof createClient>)
  await expect(fetchBadgeCount("requirements", "demo-site", new AbortController().signal)).resolves.toBe(7)
  expect(builder.abortSignal).not.toHaveBeenCalled()
})

test("installed Supabase SDK forwards actual AbortSignal and count/status semantics to an offline transport", async () => {
  const requests: { url: URL; options: RequestInit }[] = []
  const transport = jest.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    requests.push({ url: new URL(String(input)), options: options ?? {} })
    return {
      ok: true, status: 200, statusText: "OK",
      headers: new Headers({ "content-range": "0-0/1234" }),
      text: async () => "",
    } as Response
  })
  const sdk = createSdkClient("https://badge-sdk.invalid", randomBytes(24).toString("hex"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: transport },
  })
  makeClient.mockReturnValue(sdk)
  const abort = new AbortController()
  await expect(fetchBadgeCount("requirements", "site-a", abort.signal)).resolves.toBe(1234)
  expect(requests).toHaveLength(1)
  expect(requests[0].url.hostname).toBe("badge-sdk.invalid")
  expect(requests[0].url.searchParams.get("status")).toBe("eq.on-review")
  expect(requests[0].url.searchParams.get("site_id")).toBe("eq.site-a")
  expect(requests[0].options.method).toBe("HEAD")
  expect(requests[0].options.signal).toBe(abort.signal)
  await sdk.auth.signOut({ scope: "local" })
})