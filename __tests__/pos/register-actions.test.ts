/** @jest-environment node */
import { getRegisterDashboard, getRegisterSummary, openRegister, moveRegisterCash, closeRegister, getActiveRegisterForPayment } from "@/app/pos/register/actions"
import { requirePosSiteAccess } from "@/app/pos/actions/site-access"
import { registerCloseSchema, registerDashboardSchema, registerError, registerMoveSchema } from "@/app/pos/register/validation"

jest.mock("server-only", () => ({}))
jest.mock("@/app/pos/actions/site-access", () => ({ requirePosSiteAccess: jest.fn() }))
const siteId = "11111111-1111-4111-8111-111111111111"
const locationId = "22222222-2222-4222-8222-222222222222"
const sessionId = "33333333-3333-4333-8333-333333333333"
const requestId = "44444444-4444-4444-8444-444444444444"
const from = jest.fn()
const rpc = jest.fn()
const access = (role = "owner") => ({ supabase: { from, rpc }, user: { id: "actor" }, role })
function query(result: unknown) {
  const builder = { select: jest.fn(), eq: jest.fn(), gte: jest.fn(), lt: jest.fn(), order: jest.fn(),
    range: jest.fn(), maybeSingle: jest.fn(), limit: jest.fn() }
  for (const method of ["select", "eq", "gte", "lt", "order"] as const) builder[method].mockReturnValue(builder)
  for (const method of ["range", "maybeSingle", "limit"] as const) builder[method].mockResolvedValue(result)
  return builder
}

describe("Cash register server authorization and validation", () => {
  beforeEach(() => { jest.clearAllMocks(); jest.mocked(requirePosSiteAccess).mockResolvedValue(access() as never) })

  it("rejects unauthenticated and marketing callers without database reads or mutations", async () => {
    for (const identity of [{ error: "Not authenticated" }, access("marketing")]) {
      jest.mocked(requirePosSiteAccess).mockResolvedValue(identity as never)
      expect(await openRegister({ siteId, locationId, currency: "USD", openingAmount: 10, requestId })).toHaveProperty("error")
      expect(await getRegisterDashboard({ siteId, locationId })).toHaveProperty("error")
    }
    expect(from).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled()
  })

  it("validates IDs, finite cents, positive movements and real ordered calendar dates", async () => {
    expect(await openRegister({ siteId: "demo-1", locationId, currency: "USD", openingAmount: 10, requestId })).toHaveProperty("error")
    expect(requirePosSiteAccess).not.toHaveBeenCalled()
    for (const countedAmount of [NaN, Infinity, -1, 1.001]) {
      expect(registerCloseSchema.safeParse({ siteId, sessionId, countedAmount, notes: "", requestId }).success).toBe(false)
    }
    expect(registerMoveSchema.safeParse({ siteId, sessionId, kind: "cash_out", amount: 0, reason: " ", requestId }).success).toBe(false)
    for (const filters of [{ from: "2026-02-30" }, { from: "2026-10-19", to: "2026-10-18" }]) {
      expect(registerDashboardSchema.safeParse({ siteId, locationId, ...filters }).success).toBe(false)
    }
  })

  it("derives actor inside RPC and forwards only validated opening fields", async () => {
    rpc.mockResolvedValue({ data: { id: sessionId }, error: null })
    expect(await openRegister({ siteId, locationId, currency: "USD", openingAmount: 20, requestId })).toEqual({ data: { id: sessionId } })
    expect(rpc).toHaveBeenCalledWith("pos_register_open", {
      p_site_id: siteId, p_location_id: locationId, p_currency: "USD", p_opening_amount: 20, p_request_id: requestId,
    })
    expect(await openRegister({ siteId, locationId, currency: "USD", openingAmount: 20, requestId, userId: "forged" })).toHaveProperty("error")
  })

  it("does not call mutation RPCs for foreign or missing sessions", async () => {
    const builder = query({ data: null, error: null }); from.mockReturnValue(builder)
    expect(await closeRegister({ siteId, sessionId, countedAmount: 10, notes: "", requestId })).toHaveProperty("error")
    expect(await moveRegisterCash({ siteId, sessionId, kind: "cash_out", amount: 2, reason: "Safe deposit", requestId })).toHaveProperty("error")
    expect(builder.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(builder.eq).toHaveBeenCalledWith("id", sessionId)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("reads immutable closed snapshots instead of recomputing history", async () => {
    const snapshot = { expected_amount: 100 }
    from.mockReturnValue(query({ data: { id: sessionId, status: "closed", snapshot }, error: null }))
    expect(await getRegisterSummary({ siteId, sessionId })).toEqual({ data: snapshot })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("paginates history with inclusive start/exclusive end UTC and stable order", async () => {
    const history = query({ data: Array.from({ length: 21 }, (_, i) => ({ id: `${i}` })), error: null })
    const active = query({ data: null, error: null })
    from.mockReturnValueOnce(history).mockReturnValueOnce(active)
    const result = await getRegisterDashboard({ siteId, locationId, from: "2026-10-01", to: "2026-10-18", page: 1 })
    expect(result.data?.history).toHaveLength(20); expect(result.data?.hasMore).toBe(true)
    expect(history.gte).toHaveBeenCalledWith("closed_at", "2026-10-01T00:00:00.000Z")
    expect(history.lt).toHaveBeenCalledWith("closed_at", "2026-10-19T00:00:00.000Z")
    expect(history.range).toHaveBeenCalledWith(20, 40)
  })

  it("never presents database failures as a balanced zero or leaks provider error details", async () => {
    from.mockReturnValue(query({ data: null, error: { code: "42P01", message: "private database info" } }))
    expect(await getRegisterDashboard({ siteId, locationId })).toEqual({ error: expect.stringContaining("migration") })
    expect(registerError({ code: "XX000", message: "secret details" })).not.toContain("secret")
  })

  it("resolves only one owned register when no location is supplied and rejects another cashier", async () => {
    const builder = query({ data: [{ id: sessionId, opened_by: "actor" }], error: null })
    from.mockReturnValue(builder)
    expect((await getActiveRegisterForPayment({ siteId })).data?.id).toBe(sessionId)
    expect(builder.eq).toHaveBeenCalledWith("opened_by", "actor")
    jest.mocked(requirePosSiteAccess).mockResolvedValue(access("collaborator") as never)
    from.mockReturnValue(query({ data: [{ id: sessionId, opened_by: "other" }], error: null }))
    expect(await getActiveRegisterForPayment({ siteId, locationId })).toHaveProperty("error")
  })

  it("distinguishes missing and ambiguous shifts from authorization or database failures", async () => {
    from.mockReturnValue(query({ data: [], error: null }))
    expect(await getActiveRegisterForPayment({ siteId, locationId })).toMatchObject({ code: "register_required" })
    from.mockReturnValue(query({ data: [{ id: sessionId }, { id: requestId }], error: null }))
    expect(await getActiveRegisterForPayment({ siteId })).toMatchObject({ code: "register_location_required" })
    from.mockReturnValue(query({ data: null, error: { code: "42P01" } }))
    expect(await getActiveRegisterForPayment({ siteId, locationId })).not.toHaveProperty("code")
    jest.mocked(requirePosSiteAccess).mockResolvedValue({ error: "Not authenticated" } as never)
    expect(await getActiveRegisterForPayment({ siteId, locationId })).not.toHaveProperty("code")
  })

  it("allows a manager to use the sole selected location's shift without owning it", async () => {
    const builder = query({ data: [{ id: sessionId, opened_by: "another-cashier" }], error: null })
    from.mockReturnValue(builder)
    expect((await getActiveRegisterForPayment({ siteId, locationId })).data?.id).toBe(sessionId)
    expect(builder.eq).toHaveBeenCalledWith("location_id", locationId)
    expect(builder.eq).not.toHaveBeenCalledWith("opened_by", "actor")
  })
})