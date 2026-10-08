import { getChannelRoutingMetadata, getEnabledSiteChannels } from "@/lib/site-channels"
import { assignableSiteMembers } from "@/lib/auth/assignable-site-members"
import type { SiteMember } from "@/app/services/site-members-service"

it("excludes license-suspended routes even if a provider reports connected", () => {
  const site = { settings: { channels: { connections: [{ id: "a", type: "whatsapp", status: "connected", license_suspended: true }] }, social_media: [{ platform: "instagram", isActive: true, license_suspended: true }] } }
  expect(getEnabledSiteChannels(site)).toEqual([])
  expect(getChannelRoutingMetadata(site, "whatsapp")).toBeUndefined()
})

it("retains records but excludes suspended members from new work assignments", () => {
  const base: SiteMember = { id: "a", site_id: "site", user_id: "user", email: "user@example.test", name: null, position: null, role: "collaborator", status: "active", added_by: null, created_at: "", updated_at: "" }
  expect(assignableSiteMembers([{ ...base, license_suspended: true }])).toEqual([])
  expect(assignableSiteMembers([base])).toEqual([base])
})