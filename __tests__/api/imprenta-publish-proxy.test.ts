/** @jest-environment node */
import { randomBytes } from "node:crypto"
import { NextRequest } from "next/server"
import { POST } from "@/app/api/robots/instance/assistant/route"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { acquireOperationLeaseResult, releaseLeasesWithStream } from "@/lib/redis/operation-lease"

jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))
jest.mock("@/lib/redis/operation-lease", () => ({ acquireOperationLeaseResult: jest.fn(), releaseLeasesWithStream: jest.fn() }))

const previousUrl = process.env.API_SERVER_URL
const previousKey = process.env.SERVICE_API_KEY
const maybeSingle = jest.fn()
const query = { select: jest.fn(), eq: jest.fn(), maybeSingle }
const from = jest.fn()
const node = {
  id: "node", instance_id: "instance", site_id: "site", type: "publish", prompt: null,
  settings: { publish_destinations: ["whatsapp:connection:wa-2"] }, updated_at: "2026-10-16T00:00:00Z",
}
const request = (body: Record<string, unknown> = {}) => new NextRequest("https://app.example.invalid/api/robots/instance/assistant", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ site_id: "site", instance_node_id: "node", instance_id: "instance", ...body }),
})

beforeEach(() => {
  jest.resetAllMocks()
  process.env.API_SERVER_URL = "https://api.example.invalid"
  delete process.env.SERVICE_API_KEY
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  from.mockReturnValue(query)
  maybeSingle.mockResolvedValue({ data: node, error: null })
  ;(requireSiteAccess as jest.Mock).mockResolvedValue({ userId: "user", role: "owner", supabase: {
    from, auth: { getSession: jest.fn().mockResolvedValue({ data: { session: {
      access_token: randomBytes(32).toString("hex"), user: { id: "user" },
    } }, error: null }) },
  } })
  ;(acquireOperationLeaseResult as jest.Mock).mockResolvedValue({ status: "acquired", lease: { release: jest.fn() } })
  ;(releaseLeasesWithStream as jest.Mock).mockReturnValue(null)
  ;(fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 200 }))
})

afterAll(() => {
  if (previousUrl === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = previousUrl
  if (previousKey === undefined) delete process.env.SERVICE_API_KEY
  else process.env.SERVICE_API_KEY = previousKey
})

it("forwards saved exact account selection instead of client-injected tool routing", async () => {
  expect((await POST(request({
    context: JSON.stringify({ publish_destinations: ["whatsapp:connection:wa-1"] }),
    tool_overrides: { publish: { connection_id: "foreign", channel: "email" } },
  }))).status).toBe(200)
  const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body)
  expect(body.tool_overrides.publish).toEqual({ channel: "whatsapp", connection_id: "wa-2" })
  expect(body.tool_overrides.sendBulkMessages).toEqual({ channel: "whatsapp", connection_id: "wa-2" })
  expect(query.eq).toHaveBeenCalledWith("site_id", "site")
})

it("forwards the saved voice call intent and outbound greeting rules through the authenticated proxy", async () => {
  maybeSingle.mockResolvedValueOnce({ data: { ...node, prompt: { text: "Follow up on availability" },
    settings: { publish_destinations: ["voice-agent-call:connection:voice-2"] } }, error: null })
  expect((await POST(request({ message: "Stale intent", system_prompt: "Connected content instructions",
    tool_overrides: { publish: { is_test: true, connection_id: "wrong", voice_mode: "tts" } },
  }))).status).toBe(200)
  const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body)
  expect(body.message).toBe("Follow up on availability")
  expect(body.system_prompt).toContain("outbound call")
  expect(body.system_prompt).toContain("not the Content Creator")
  expect(body.tool_overrides.publish).toEqual({ is_test: true, channel: "voice", connection_id: "voice-2", voice_mode: "agent_call" })
})

it.each([{ publish_destinations: [] }, { publish_destinations: ["whatsapp:connection:%"] }])("rejects invalid persisted destinations before admission/forwarding %j", async ({ publish_destinations }) => {
  maybeSingle.mockResolvedValueOnce({ data: { ...node, settings: { publish_destinations } }, error: null })
  const response = await POST(request())
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({ success: false, execution_started: false })
  expect(acquireOperationLeaseResult).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it("preserves an implicit Blog node using the authorized site URL", async () => {
  maybeSingle.mockResolvedValueOnce({ data: { ...node, settings: {} }, error: null })
    .mockResolvedValueOnce({ data: { url: "https://example.com" }, error: null })
  expect((await POST(request())).status).toBe(200)
  const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body)
  expect(JSON.parse(body.context).publish_destinations).toEqual(["blog"])
  expect(from).toHaveBeenCalledWith("sites")
  expect(query.eq).toHaveBeenCalledWith("id", "site")
})

it("does not inspect or forward node selections when site access is denied", async () => {
  ;(requireSiteAccess as jest.Mock).mockResolvedValue({ error: new Response(null, { status: 403 }) })
  expect((await POST(request())).status).toBe(403)
  expect(from).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})