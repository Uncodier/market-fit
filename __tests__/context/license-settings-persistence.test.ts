/** @jest-environment node */
import { persistSiteSettings } from "@/app/context/site-update-settings"
import type { Site, SiteSettings } from "@/app/context/site-types"

jest.mock("@/app/agents/voice-sync", () => ({ requestVoiceAgentResync: jest.fn().mockResolvedValue(undefined) }))

it("publishes server-clamped settings instead of the pre-enforcement resource state", async () => {
  const siteId = "00000000-0000-4000-8000-000000000001"
  const requested = [{ id: "social", platform: "instagram", isActive: true }]
  const persisted = { site_id: siteId, social_media: [{ ...requested[0], isActive: false, license_suspended: true }] }
  const write = { select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: persisted, error: null }) }
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { site_id: siteId }, error: null }), upsert: jest.fn().mockReturnValue(write) }
  let current = { id: siteId, settings: {} } as Site
  await persistSiteSettings({
    supabase: { from: () => query }, siteId,
    settings: { social_media: requested } as unknown as Partial<SiteSettings>, currentSite: current,
    setCurrentSite: value => { current = (typeof value === "function" ? value(current) : value)! },
    setSites: jest.fn(), loadSites: jest.fn(), setError: jest.fn(), shouldPreventRefresh: () => true, isOnProtectedPage: () => false,
  })
  expect(write.select).toHaveBeenCalled()
  expect(current.settings?.social_media).toEqual(persisted.social_media)
})