/** @jest-environment node */
import { randomBytes } from "node:crypto"
import { NextRequest } from "next/server"
import { POST } from "@/app/api/secrets/route"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { createClient } from "@supabase/supabase-js"

jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))
jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }))
const siteId = "11111111-1111-4111-8111-111111111111"
const auth = requireSiteAccess as jest.Mock
const previousKey = process.env.ENCRYPTION_KEY

function request(values: Record<string, unknown>, origin = "https://app.example.test") {
  return new NextRequest("https://app.example.test/api/secrets", {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ siteId, provider: "composio", useCase: "integrations", ...values }),
  })
}

beforeEach(() => { jest.clearAllMocks(); auth.mockResolvedValue({ userId: siteId, role: "owner" }) })
afterAll(() => { if (previousKey === undefined) delete process.env.ENCRYPTION_KEY; else process.env.ENCRYPTION_KEY = previousKey })

it.each([
  { operation: "retrieve" },
  { operation: "store", instanceId: siteId, name: "key", secretValue: randomBytes(20).toString("hex") },
  { operation: "check", useCase: "unexpected" },
])("keeps Composio credentials write-only and site scoped (%#)", async body => {
  expect((await POST(request(body)))!.status).toBe(403)
  expect(createClient).not.toHaveBeenCalled()
})

it.each([{ provider: ["composio"] }, { useCase: ["integrations"] }, { provider: { toString: "composio" } }])("rejects coercible fields before the write-only comparison (%#)", async values => {
  expect((await POST(request({ operation: "retrieve", ...values })))!.status).toBe(400)
  expect(createClient).not.toHaveBeenCalled()
})

it("does not use a fallback encryption key", async () => {
  delete process.env.ENCRYPTION_KEY
  expect((await POST(request({ operation: "store", name: "Composio", secretValue: randomBytes(20).toString("hex") })))!.status).toBe(400)
  expect(createClient).not.toHaveBeenCalled()
})

it("rejects cross-origin credential mutation before service-role access", async () => {
  expect((await POST(request({ operation: "delete" }, "https://foreign.example.test")))!.status).toBe(403)
  expect(createClient).not.toHaveBeenCalled()
})