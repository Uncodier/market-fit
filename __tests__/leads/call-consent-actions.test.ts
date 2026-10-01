/** @jest-environment node */

import { updateLeadCallConsent } from "@/app/leads/call-consent-actions"
import { updateLead } from "@/app/leads/mutation-actions"
import { getLeadById } from "@/app/leads/read-actions"
import { createClient } from "@/lib/supabase/server"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/app/companies/actions", () => ({ findOrCreateCompany: jest.fn() }))

const id = "11111111-1111-4111-8111-111111111111"
const siteId = "22222222-2222-4222-8222-222222222222"
const at = "2026-01-01T10:00:00.000Z"
const expected = {
  voice_call_consent_status: "unknown",
  voice_call_consent_at: null,
  do_not_call: false,
  phone: "+12025550123",
  updated_at: at,
}
const input = {
  id, site_id: siteId, confirmed: true, expected,
  voice_call_consent_status: "granted", voice_call_consent_at: at, do_not_call: false,
}
const saved = {
  id, voice_call_consent_status: "granted", voice_call_consent_at: at,
  do_not_call: false, updated_at: "2026-01-02T10:00:00.000Z",
}
const query = {
  update: jest.fn(), eq: jest.fn(), is: jest.fn(), select: jest.fn(), maybeSingle: jest.fn(), single: jest.fn(),
}
const from = jest.fn(() => query)
const getUser = jest.fn()
const rpc = jest.fn()

beforeEach(() => {
  jest.resetAllMocks()
  from.mockReturnValue(query)
  for (const method of [query.update, query.eq, query.is, query.select]) method.mockReturnValue(query)
  query.maybeSingle.mockResolvedValue({ data: saved, error: null })
  getUser.mockResolvedValue({ data: { user: { id: "signed-in-user" } }, error: null })
  rpc.mockResolvedValue({ data: true, error: null })
  jest.mocked(createClient).mockResolvedValue({ from, auth: { getUser }, rpc } as never)
})

it("saves only consent fields using a real user-scoped client and update capability", async () => {
  expect(await updateLeadCallConsent(input)).toEqual({ lead: saved })
  expect(createClient).toHaveBeenCalledWith(true)
  expect(rpc).toHaveBeenCalledWith("user_can", { p_site_id: siteId, p_command: "update" })
  expect(from).toHaveBeenCalledWith("leads")
  expect(query.update).toHaveBeenCalledWith({
    voice_call_consent_status: "granted", voice_call_consent_at: at,
    do_not_call: false, updated_at: expect.any(String),
  })
  expect(query.eq).toHaveBeenCalledWith("id", id)
  expect(query.eq).toHaveBeenCalledWith("site_id", siteId)
  expect(query.eq).toHaveBeenCalledWith("updated_at", at)
  expect(query.eq).toHaveBeenCalledWith("voice_call_consent_status", "unknown")
  expect(query.eq).toHaveBeenCalledWith("do_not_call", false)
  expect(query.eq).toHaveBeenCalledWith("phone", expected.phone)
  expect(query.is).toHaveBeenCalledWith("voice_call_consent_at", null)
})

it.each([
  { confirmed: false }, { confirmed: undefined }, { id: "not-a-uuid" }, { site_id: "demo-site" },
  { voice_call_consent_status: "yes" }, { voice_call_consent_at: null },
  { voice_call_consent_at: "bad-date" }, { voice_call_consent_at: "2999-01-01T10:00:00Z" },
  { do_not_call: "false" }, { user_id: "forged-actor" }, { updated_at: "forged-time" },
  { phone: "+12025550124" }, { voice_call_consent_status: "revoked", voice_call_consent_at: at },
  { expected: { ...expected, updated_at: undefined } },
])("rejects invalid/unconfirmed/extra input before database access: %j", async (override) => {
  expect(await updateLeadCallConsent({ ...input, ...override })).toHaveProperty("error")
  expect(createClient).not.toHaveBeenCalled()
})

it.each([
  { data: { user: null }, error: null },
  { data: { user: { id: "user" } }, error: { message: "expired" } },
])("rejects missing or invalid sessions", async (auth) => {
  getUser.mockResolvedValue(auth)
  expect(await updateLeadCallConsent(input)).toEqual({ error: "Sign in to update call consent." })
  expect(rpc).not.toHaveBeenCalled()
  expect(from).not.toHaveBeenCalled()
})

it.each([
  { data: false, error: null }, { data: null, error: null },
  { data: true, error: { message: "unavailable" } },
])("fails closed for read-only/non-member/failed permissions", async (permission) => {
  rpc.mockResolvedValue(permission)
  expect(await updateLeadCallConsent(input)).toHaveProperty("error", expect.stringContaining("permission"))
  expect(from).not.toHaveBeenCalled()
})

it("does not report stale, cross-site, missing, or RLS-inaccessible zero-row updates as saved", async () => {
  query.maybeSingle.mockResolvedValue({ data: null, error: null })
  expect(await updateLeadCallConsent(input)).toEqual({
    error: "The lead changed or is no longer accessible. Reload it before editing call consent again.",
  })
  expect(query.eq).toHaveBeenCalledWith("site_id", siteId)
  expect(query.update).toHaveBeenCalledTimes(1)
})

it("can revoke consent and enable do-not-call without granting anything", async () => {
  await updateLeadCallConsent({
    ...input, voice_call_consent_status: "revoked", voice_call_consent_at: null, do_not_call: true,
    expected: { ...expected, voice_call_consent_status: "granted", voice_call_consent_at: at, phone: null },
  })
  expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
    voice_call_consent_status: "revoked", voice_call_consent_at: null, do_not_call: true,
  }))
  expect(query.eq).toHaveBeenCalledWith("voice_call_consent_at", at)
  expect(query.is).toHaveBeenCalledWith("phone", null)
})

it("removing do-not-call preserves unknown consent", async () => {
  await updateLeadCallConsent({
    ...input, voice_call_consent_status: "unknown", voice_call_consent_at: null,
    expected: { ...expected, do_not_call: true },
  })
  expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
    voice_call_consent_status: "unknown", voice_call_consent_at: null, do_not_call: false,
  }))
})

it("redacts database errors and never retries a failed write", async () => {
  query.maybeSingle.mockResolvedValue({ data: null, error: { message: "private database detail" } })
  const result = await updateLeadCallConsent(input)
  expect(result.error).toContain("Reload")
  expect(result.error).not.toContain("private")
  expect(query.update).toHaveBeenCalledTimes(1)
})

it("does not automatically replay an ambiguous network failure", async () => {
  query.maybeSingle.mockRejectedValue(new Error("network disconnected"))
  expect(await updateLeadCallConsent(input)).toHaveProperty("error", expect.stringContaining("confirm whether"))
  expect(query.update).toHaveBeenCalledTimes(1)
})

it.each(["voice_call_consent_status", "voice_call_consent_at", "do_not_call"])(
  "blocks bypassing confirmation through generic updateLead: %s", async (field) => {
    const result = await updateLead({ id, site_id: siteId, [field]: "forged" })
    expect(result.error).toContain("call consent editor")
    expect(from).not.toHaveBeenCalled()
  }
)

it("loads saved consent fields in the site-scoped lead details query", async () => {
  query.single.mockResolvedValue({ data: saved, error: null })
  const result = await getLeadById(id, siteId)
  const selection = query.select.mock.calls[0][0]
  for (const field of ["voice_call_consent_status", "voice_call_consent_at", "do_not_call"]) {
    expect(selection).toContain(field)
  }
  expect(query.eq).toHaveBeenCalledWith("id", id)
  expect(query.eq).toHaveBeenCalledWith("site_id", siteId)
  expect(result.lead).toMatchObject(saved)
})