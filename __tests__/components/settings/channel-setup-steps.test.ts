import {
  buildEmailSetupSteps,
  buildPhoneSetupSteps,
} from "@/app/components/settings/channel-setup-steps"

describe("channel setup steps", () => {
  it("moves email from DNS through inbound to activation", () => {
    expect(buildEmailSetupSteps({
      domainVerified: true,
      inboundEnabled: false,
      channelActive: false,
    })).toEqual([
      { label: "DNS Verification", status: "complete" },
      { label: "Inbound", status: "current" },
      { label: "Activation", status: "upcoming" },
    ])

    expect(buildEmailSetupSteps({
      domainVerified: true,
      inboundEnabled: true,
      channelActive: false,
    })[2]).toEqual({ label: "Activation", status: "current" })
  })

  it("shows phone compliance review between number assignment and activation", () => {
    expect(buildPhoneSetupSteps({
      status: "in_progress",
      metadata: {
        phone_number_id: "pn_1",
        regulatory_status: "pending_review",
      },
    })).toEqual([
      { label: "Phone Number", status: "complete" },
      { label: "Compliance", status: "current" },
      { label: "Activation", status: "upcoming" },
    ])
  })

  it("shows rejected phone compliance as an error", () => {
    expect(buildPhoneSetupSteps({
      status: "failed",
      metadata: {
        phone_number: "+14155550100",
        regulatory_status: "rejected",
      },
    })[1]).toEqual({ label: "Compliance", status: "error" })
  })
})
