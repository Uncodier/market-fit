/** @jest-environment node */
import { NextRequest } from "next/server"
import { proxySkills } from "@/app/api/skills/skills-proxy"
import { requireSiteAccess } from "@/lib/auth/api-site-access"

jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))

const siteId = "11111111-1111-4111-8111-111111111111"
const skillId = "22222222-2222-4222-8222-222222222222"
const access = requireSiteAccess as jest.Mock
const oldFetch = global.fetch
const oldApiKey = process.env.SERVICE_API_KEY
const oldApiUrl = process.env.API_SERVER_URL

function request(path: string, method = "GET", body?: Record<string, unknown>) {
  return new NextRequest(`https://app.test${path}`, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
  })
}

describe("skills BFF", () => {
  beforeEach(() => {
    access.mockReset()
    access.mockResolvedValue({ userId: "user", supabase: { auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: "trusted-user-jwt", user: { id: "user" } } }, error: null }) } } })
    process.env.SERVICE_API_KEY = "secret"
    process.env.API_SERVER_URL = "https://backend.test"
    global.fetch = jest.fn().mockResolvedValue(Response.json({ success: true, skills: [] }))
  })
  afterAll(() => {
    global.fetch = oldFetch
    process.env.SERVICE_API_KEY = oldApiKey
    process.env.API_SERVER_URL = oldApiUrl
  })

  it("rejects missing site and unauthorized access without forwarding", async () => {
    expect((await proxySkills(request("/api/skills"), "catalog")).status).toBe(400)
    access.mockResolvedValueOnce({ error: Response.json({ error: "Forbidden" }, { status: 403 }) })
    expect((await proxySkills(request(`/api/skills?site_id=${siteId}`), "catalog")).status).toBe(403)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("authorizes writes as site manager and forwards the server-verified user session", async () => {
    const response = await proxySkills(request("/api/skills", "POST", { site_id: siteId, content: "# Skill", user_id: "forged" }), "catalog")
    expect(response.status).toBe(200)
    expect(access).toHaveBeenCalledWith(expect.anything(), siteId, { requireManager: true })
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url.toString()).toBe("https://backend.test/api/skills")
    expect(init.headers).toEqual({ authorization: "Bearer trusted-user-jwt", "content-type": "application/json" })
    expect(JSON.parse(init.body)).toEqual({ site_id: siteId, content: "# Skill" })
  })

  it("scopes DELETE by query site ID and validates IDs", async () => {
    expect((await proxySkills(request(`/api/skills/bad`, "DELETE", { site_id: siteId }), "item", "bad")).status).toBe(400)
    await proxySkills(request(`/api/skills/${skillId}`, "DELETE", { site_id: siteId }), "item", skillId)
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url.searchParams.get("site_id")).toBe(siteId)
    expect(init.body).toBeUndefined()
  })

  it("forwards enabled-only updates and rejects invalid enabled values", async () => {
    await proxySkills(request(`/api/skills/${skillId}`, "PATCH", { site_id: siteId, enabled: false }), "item", skillId)
    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ site_id: siteId, enabled: false })
    expect((await proxySkills(request(`/api/skills/${skillId}`, "PATCH", { site_id: siteId, enabled: "false" }), "item", skillId)).status).toBe(400)
  })

  it("requires a SHA-256 preview digest for imports and forwards it unchanged", async () => {
    const path = "/api/skills/external/import"
    expect((await proxySkills(request(path, "POST", { site_id: siteId, url: "https://github.com/a/b/blob/main/SKILL.md" }), "import")).status).toBe(400)
    const sha256 = "a".repeat(64)
    await proxySkills(request(path, "POST", { site_id: siteId, url: "https://github.com/a/b/blob/main/SKILL.md", sha256 }), "import")
    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ site_id: siteId, url: "https://github.com/a/b/blob/main/SKILL.md", sha256 })
  })

  it("rejects unsafe import URLs before contacting API", async () => {
    expect((await proxySkills(request("/api/skills/external/import", "POST", { site_id: siteId, url: "http://localhost/private" }), "import")).status).toBe(400)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})