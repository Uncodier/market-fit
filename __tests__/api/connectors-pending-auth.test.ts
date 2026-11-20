/** @jest-environment node */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { GET } from "@/app/api/connectors/pending-auth/route"
import { proxyConnector } from "@/app/api/connectors/proxy"
import { setAttemptCookie } from "@/app/api/connectors/attempt-cookie"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/app/api/connectors/proxy", () => ({ proxyConnector: jest.fn() }))
const userId = "22222222-2222-4222-8222-222222222222"
const siteId = "11111111-1111-4111-8111-111111111111"
const attemptId = "33333333-3333-4333-8333-333333333333"
const proxy = jest.mocked(proxyConnector)
function request(actor = userId) {
  const response = NextResponse.json({})
  setAttemptCookie(response, attemptId, { site_id: siteId, user_id: actor, nonce: "a".repeat(64) })
  return new NextRequest("https://app.example.test/api/connectors/pending-auth", { headers: { cookie: response.headers.get("set-cookie")!.split(";")[0] } })
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) } } as never)
})

test.each([
  ["completed", "2099-01-01T00:00:00Z"],
  ["outcome_unknown", "2099-01-01T00:00:00Z"],
  ["pending", "2000-01-01T00:00:00Z"],
  ["pending", "invalid"],
  ["pending", undefined],
])("excludes %s attempt with expiry %s from selection", async (status, expires_at) => {
  proxy.mockResolvedValueOnce(Response.json({ user_id: userId, toolkit_slug: "mail", status, expires_at }))
  expect(await (await GET(request())).json()).toEqual({ items: [] })
})

test("only lists unexpired pending attempts for current actor", async () => {
  proxy.mockResolvedValueOnce(Response.json({ user_id: userId, toolkit_slug: "mail", status: "pending", expires_at: "2099-01-01T00:00:00Z" }))
  expect(await (await GET(request())).json()).toEqual({ items: [{ attempt_id: attemptId, site_id: siteId, toolkit_slug: "mail", status: "pending" }] })
  proxy.mockClear()
  expect(await (await GET(request(siteId))).json()).toEqual({ items: [] })
  expect(proxy).not.toHaveBeenCalled()
})

test("does not expose a response belonging to another actor", async () => {
  proxy.mockResolvedValueOnce(Response.json({ user_id: siteId, toolkit_slug: "mail", status: "pending", expires_at: "2099-01-01T00:00:00Z" }))
  expect(await (await GET(request())).json()).toEqual({ items: [] })
})