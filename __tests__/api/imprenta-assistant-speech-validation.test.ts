/** @jest-environment node */
import { randomBytes } from "node:crypto"
import { NextRequest } from "next/server"
import { POST } from "@/app/api/robots/instance/assistant/route"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { acquireOperationLeaseResult } from "@/lib/redis/operation-lease"

jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))
jest.mock("@/lib/redis/operation-lease", () => ({
  acquireOperationLeaseResult: jest.fn(),
  releaseLeasesWithStream: jest.fn(),
}))

const previousUrl = process.env.API_SERVER_URL
const previousKey = process.env.SERVICE_API_KEY
const maybeSingle = jest.fn()
const query = { select: jest.fn(), eq: jest.fn(), maybeSingle }
const from = jest.fn()
const snapshot = {
  id: "node", instance_id: "instance", site_id: "site", type: "generate-audio",
  prompt: { text: "Write a welcome message" }, updated_at: "2026-10-04T00:00:00Z",
}

beforeEach(() => {
  jest.resetAllMocks()
  process.env.API_SERVER_URL = "https://api.example.invalid"
  delete process.env.SERVICE_API_KEY
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  from.mockReturnValue(query)
  ;(requireSiteAccess as jest.Mock).mockResolvedValue({
    userId: "user", role: "owner",
    supabase: {
      from,
      auth: { getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: randomBytes(32).toString("hex"), user: { id: "user" } } },
        error: null,
      }) },
    },
  })
})

afterAll(() => {
  if (previousUrl === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = previousUrl
  if (previousKey === undefined) delete process.env.SERVICE_API_KEY
  else process.env.SERVICE_API_KEY = previousKey
})

it.each([
  { voice: "unsupported" }, { voice: 42 }, { language: "unsupported" }, { language: false },
])("rejects invalid persisted selections %j before admission or forwarding", async parameters => {
  maybeSingle.mockResolvedValue({ data: { ...snapshot, settings: { parameters } }, error: null })
  const response = await POST(new NextRequest("https://app.example.invalid/api/robots/instance/assistant", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      site_id: "site", instance_node_id: "node", instance_id: "instance",
      context: { parameters: { voice: "nova", language: "es" } },
    }),
  }))
  expect(response.status).toBe(400)
  const body = await response.json()
  expect(body).toMatchObject({ success: false, execution_started: false })
  expect(body.error.message).toMatch(/^Speech (voice|language) must be auto or a supported/)
  expect(body.error.message).not.toContain("unsupported")
  expect(acquireOperationLeaseResult).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})