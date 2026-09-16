import { buildSupportChannelNavigation } from "@/app/components/settings/support-channel-navigation"

describe("support channel navigation", () => {
  it("creates one quick-navigation entry per channel card", () => {
    expect(buildSupportChannelNavigation([
      { name: "Sales Email", type: "email" },
      { type: "sms" },
      {},
    ])).toEqual([
      { id: "support-channel-0", title: "Sales Email" },
      { id: "support-channel-1", title: "SMS" },
      { id: "support-channel-2", title: "New Channel" },
    ])
  })
})
