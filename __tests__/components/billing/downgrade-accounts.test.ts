import { accountsToDisconnect } from "@/app/components/billing/downgrade-accounts"
import type { Site } from "@/app/context/site-types"

describe("accountsToDisconnect", () => {
  it("returns connected channels and socials that were not kept", () => {
    const site: Partial<Site> = {
      settings: {
        channels: {
          connections: [
            { id: "ch-keep", type: "whatsapp", status: "connected" as const, zavu_sender_id: "snd_keep" },
            { id: "ch-drop", type: "whatsapp", status: "connected" as const, zavu_sender_id: "snd_drop" },
            { id: "ch-pending", type: "whatsapp", status: "pending" as const, zavu_invitation_id: "inv_1" },
          ],
        },
        social_media: [
          { id: "soc-keep", platform: "facebook", url: "https://facebook.com/example", isActive: true },
          { id: "soc-drop", platform: "instagram", url: "https://instagram.com/example", isActive: true },
          { platform: "github", url: "https://github.com/example", isActive: false },
        ],
      },
    }

    const result = accountsToDisconnect(site, ["ch-keep", "social-soc-keep"])

    expect(result.channels.map((item) => item.channel.id)).toEqual(["ch-drop"])
    expect(result.socials.map((item) => item.social.id)).toEqual(["soc-drop"])
  })
})
