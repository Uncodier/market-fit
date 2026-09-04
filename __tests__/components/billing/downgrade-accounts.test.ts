import { accountsToDisconnect } from "@/app/components/billing/downgrade-accounts"

describe("accountsToDisconnect", () => {
  it("returns connected channels and socials that were not kept", () => {
    const site = {
      settings: {
        channels: {
          connections: [
            { id: "ch-keep", status: "connected" as const, zavu_sender_id: "snd_keep" },
            { id: "ch-drop", status: "connected" as const, zavu_sender_id: "snd_drop" },
            { id: "ch-pending", status: "pending" as const, zavu_invitation_id: "inv_1" },
          ],
        },
        social_media: [
          { id: "soc-keep", platform: "facebook", isActive: true },
          { id: "soc-drop", platform: "instagram", isActive: true },
          { platform: "github", isActive: false },
        ],
      },
    }

    const result = accountsToDisconnect(site, ["ch-keep", "social-soc-keep"])

    expect(result.channels.map((item) => item.channel.id)).toEqual(["ch-drop"])
    expect(result.socials.map((item) => item.social.id)).toEqual(["soc-drop"])
  })
})
