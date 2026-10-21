/** @jest-environment node */
import { postTunneledApi, startTunneledApi } from "@/app/quotations/dynamic-quote-apply"
import { after } from "next/server"

jest.mock("server-only", () => ({}))
jest.mock("next/server", () => ({ after: jest.fn() }))
jest.mock("@/app/catalog/tax-actions", () => ({ getTaxesByCatalogItemIds: jest.fn() }))

const original = { serviceKey: process.env.SERVICE_API_KEY, apiUrl: process.env.API_SERVER_URL }
beforeEach(() => {
  jest.clearAllMocks()
  process.env.SERVICE_API_KEY = "test-only-service-key"
  process.env.API_SERVER_URL = "https://quote-api.example.com"
})
afterAll(() => {
  if (original.serviceKey === undefined) delete process.env.SERVICE_API_KEY
  else process.env.SERVICE_API_KEY = original.serviceKey
  if (original.apiUrl === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = original.apiUrl
})

it.each(["https://evil.example/api", "/api/private/secrets", "//evil.example/api", "/api/robots/instance/assistant?redirect=evil"])(
  "never sends the service key to an arbitrary endpoint %s", async (endpoint) => {
    expect((await postTunneledApi(endpoint, {})).success).toBe(false)
    expect((await startTunneledApi(endpoint, {})).started).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
    expect(after).not.toHaveBeenCalled()
  },
)

it("uses only the configured origin and disables service-key forwarding through redirects", async () => {
  ;(fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200,
    headers: new Headers({ "content-type": "application/json" }), text: async () => '{"success":true}' })
  await postTunneledApi("/api/robots/instance/assistant", { site_id: "authorized-site" })
  expect(fetch).toHaveBeenCalledWith("https://quote-api.example.com/api/robots/instance/assistant", expect.objectContaining({
    redirect: "error", headers: expect.objectContaining({ "x-api-key": "test-only-service-key" }),
  }))
})