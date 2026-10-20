import { renderHook, waitFor } from "@testing-library/react"
import { useRequiredLicense } from "@/app/components/billing/use-required-license"
import type { Site } from "@/app/context/site-types"

jest.mock("@/app/services/site-members-service", () => ({ siteMembersService: { getLicense: jest.fn().mockResolvedValue({ current: 1, total: 1 }) } }))

function siteWith(connections: unknown[]): Site {
  return { id: "site", billing: { plan: "commission", addons_count: 0 }, settings: { channels: { connections } } } as unknown as Site
}

describe("channel license recommendations", () => {
  beforeEach(() => window.history.replaceState({}, "", "/billing"))

  it("excludes manual and explicitly disabled channels from plan demand", async () => {
    const site = siteWith([
      { type: "email", status: "connected", _license: { manually_disabled: true } },
      { type: "whatsapp", status: "connected", enabled: false },
      { type: "sms", status: "disabled", enabled: false, license_suspended: false, _license: { manually_disabled: true } },
      { type: "voice", status: "active", _license: { manually_disabled: true }, license_suspended: true },
    ])
    const { result } = renderHook(() => useRequiredLicense(site))
    await waitFor(() => expect(result.current.members).toBe(1))
    expect(result.current.requiredPlan).toBe("commission")
  })

  it("includes quota-suspended demand for upgrades, never manual disablement", async () => {
    const site = siteWith([
      { type: "voice", status: "synced" },
      { type: "email", status: "disabled", enabled: false, license_suspended: true },
      { type: "sms", status: "connected", _license: { manually_disabled: true } },
    ])
    const { result } = renderHook(() => useRequiredLicense(site))
    await waitFor(() => expect(result.current.members).toBe(1))
    expect(result.current.requiredPlan).toBe("foundry")
  })
})