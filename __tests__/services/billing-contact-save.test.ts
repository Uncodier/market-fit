/** @jest-environment node */
const mockRpc = jest.fn()
jest.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc: mockRpc }) }))
jest.mock("@/app/services/api-client-service", () => ({ isDemoModeActive: async () => false }))
import { billingService } from "@/app/services/billing-service"

describe("billing contact updates do not replay financial state", () => {
  beforeEach(() => { jest.clearAllMocks(); mockRpc.mockResolvedValue({ data: { success: true }, error: null }) })
  it("does not send a plan, stale aggregate or default auto-renew toggle", async () => {
    expect(await billingService.saveBillingInfo("synthetic-site", {
      plan: "foundry", credits_available: 1000, auto_renew: false, card_name: "Synthetic account",
    })).toEqual({ success: true })
    const payload = mockRpc.mock.calls[0][1]
    expect(payload).not.toHaveProperty("p_plan")
    expect(payload).not.toHaveProperty("p_credits_available")
    expect(payload.p_auto_renew).toBeNull()
  })
  it("propagates SQL rejection even when PostgREST returned transport success", async () => {
    mockRpc.mockResolvedValue({ data: { success: false, error: "Synthetic rejection" }, error: null })
    expect(await billingService.saveBillingInfo("synthetic-site", { card_name: "Synthetic" }))
      .toEqual({ success: false, error: "Synthetic rejection" })
  })
})