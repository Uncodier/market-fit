/** @jest-environment node */
jest.mock("@/lib/marketplace/poll", () => ({ pollMarketplaceStores: jest.fn() }))
import { randomBytes } from "node:crypto"
import { POST } from "@/app/api/marketplace/worker/route"
import { pollMarketplaceStores } from "@/lib/marketplace/poll"

describe("marketplace worker authentication", () => {
  const original = process.env.SERVICE_API_KEY
  beforeEach(() => { jest.clearAllMocks(); process.env.SERVICE_API_KEY = randomBytes(32).toString("hex") })
  afterAll(() => {
    if (original === undefined) delete process.env.SERVICE_API_KEY
    else process.env.SERVICE_API_KEY = original
  })
  it("fails closed without the internal dispatch credential", async () => {
    const response = await POST(new Request("https://orders.example.test/worker", { method: "POST" }))
    expect(response.status).toBe(401)
    expect(pollMarketplaceStores).not.toHaveBeenCalled()
    delete process.env.SERVICE_API_KEY
    expect((await POST(new Request("https://orders.example.test/worker", { method: "POST" }))).status).toBe(401)
  })
  it("runs a bounded recovery pass for an authenticated worker only", async () => {
    jest.mocked(pollMarketplaceStores).mockResolvedValue({ refreshed: 2, unavailable: 0 })
    const response = await POST(new Request("https://orders.example.test/worker", {
      method: "POST", headers: { 'x-api-key': process.env.SERVICE_API_KEY! },
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ refreshed: 2, unavailable: 0 })
    expect(pollMarketplaceStores).toHaveBeenCalledWith(expect.any(Number))
  })
})