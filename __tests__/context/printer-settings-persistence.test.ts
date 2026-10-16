/** @jest-environment node */
import { persistSiteSettings } from "@/app/context/site-update-settings"
import type { Site, SiteSettings } from "@/app/context/site-types"
import { capabilitiesFromRole, resetPermissionStore, setPermissionStore } from "@/lib/permissions/capabilities"
import { wrapSupabaseClient } from "@/lib/permissions/mutation-guard"

jest.mock("@/app/agents/voice-sync", () => ({ requestVoiceAgentResync: jest.fn().mockResolvedValue(undefined) }))

const siteId = "00000000-0000-4000-8000-000000000001"
const printers: NonNullable<SiteSettings["printers"]> = { devices: [{
  id: "printer-a", name: "Kitchen printer", transport: "usb", paperWidthMm: 58, copies: 1,
  modules: { pos: false, orders: true, inventory: false },
  autoPrint: { posReceipt: false, kitchenTicket: true, orderDelta: true, inventoryLabel: false },
}] }
const initial = {
  id: "00000000-0000-4000-8000-000000000002", site_id: siteId,
  social_media: [{ id: "social", isActive: true, _license: { order: 1 }, license_suspended: false }],
  channels: { connections: [{ id: "agent", status: "connected", _license: { order: 2 } }] },
  about: "Keep company information",
}

function fixture(existing: Record<string, unknown> | null = initial) {
  const result: { data: { id: string; site_id: string } | null; error: Error | null } = {
    data: { id: initial.id, site_id: siteId }, error: null,
  }
  const write = { select: jest.fn().mockReturnThis(), single: jest.fn(async () => result) }
  const update = jest.fn(() => ({ eq: jest.fn((column, value) => {
    expect([column, value]).toEqual(["site_id", siteId])
    return write
  }) }))
  const insert = jest.fn(() => write)
  const upsert = jest.fn().mockResolvedValue({ data: null, error: new Error("Resource license metadata is server managed") })
  const query = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: existing, error: existing ? null : { code: "PGRST116" } }),
    update, insert, upsert,
  }
  const currentSite = { id: siteId, settings: existing } as unknown as Site
  const deps = {
    supabase: wrapSupabaseClient({ from: jest.fn(() => query) }), siteId, currentSite,
    settings: { id: "stale-settings-id", site_id: "untrusted-site", printers } as Partial<SiteSettings>,
    setCurrentSite: jest.fn(), setSites: jest.fn(), loadSites: jest.fn(), setError: jest.fn(),
    shouldPreventRefresh: () => true, isOnProtectedPage: () => false,
  }
  return { deps, result, write, update, insert, upsert, query }
}

afterEach(() => { resetPermissionStore(); jest.restoreAllMocks() })

it.each(["owner", "admin"] as const)("saves printers as %s without resubmitting protected resources", async role => {
  setPermissionStore({ siteId, capabilities: capabilitiesFromRole(role), loaded: true })
  const state = fixture()
  await persistSiteSettings(state.deps)
  expect(state.upsert).not.toHaveBeenCalled()
  expect(state.insert).not.toHaveBeenCalled()
  expect(state.update).toHaveBeenCalledWith({ printers, updated_at: expect.any(String) })
  expect(state.write.select).toHaveBeenCalledWith("id, site_id")
  expect(state.deps.setCurrentSite.mock.calls[0][0](state.deps.currentSite).settings).toMatchObject({ ...initial, printers })
})

it("creates only the requested settings when no row exists", async () => {
  const state = fixture(null)
  await persistSiteSettings(state.deps)
  expect(state.update).not.toHaveBeenCalled()
  expect(state.insert).toHaveBeenCalledWith({ site_id: siteId, printers, updated_at: expect.any(String) })
  expect(state.deps.setCurrentSite.mock.calls[0][0](state.deps.currentSite).settings.id).toBe(initial.id)
})

it("does not insert or publish success when an existing row disappears or becomes inaccessible", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {})
  const state = fixture()
  state.result.data = null
  state.result.error = new Error("Settings update denied")
  await expect(persistSiteSettings(state.deps)).rejects.toThrow("Settings update denied")
  expect(state.insert).not.toHaveBeenCalled()
  expect(state.deps.setCurrentSite).not.toHaveBeenCalled()
  expect(state.deps.setError).toHaveBeenCalled()
})

it("does not publish an unconfirmed write even if the client returns no error", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {})
  const state = fixture()
  state.result.data = null
  await expect(persistSiteSettings(state.deps)).rejects.toThrow("Saved settings could not be verified")
  expect(state.insert).not.toHaveBeenCalled()
  expect(state.deps.setCurrentSite).not.toHaveBeenCalled()
})

it("does not write after a preservation read fails", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {})
  const state = fixture()
  state.query.single.mockResolvedValueOnce({ data: null, error: new Error("Settings unavailable") })
  await expect(persistSiteSettings(state.deps)).rejects.toThrow("Settings unavailable")
  expect(state.update).not.toHaveBeenCalled()
  expect(state.insert).not.toHaveBeenCalled()
})