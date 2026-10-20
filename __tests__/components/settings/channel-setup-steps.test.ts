import {
  buildEmailSetupSteps,
  buildPhoneSetupSteps,
} from "@/app/components/settings/channel-setup-steps"

describe("channel setup steps", () => {
  it("moves email from DNS through address, inbound and activation", () => {
    expect(buildEmailSetupSteps({
      domainVerified: true,
      senderConfigured: true,
      inboundEnabled: false,
      channelActive: false,
    })).toEqual([
      { label: "DNS Verification", status: "complete" },
      { label: "Email Address", status: "complete" },
      { label: "Inbound", status: "current" },
      { label: "Activation", status: "current" },
    ])

    expect(buildEmailSetupSteps({
      domainVerified: true,
      senderConfigured: true,
      inboundEnabled: true,
      channelActive: false,
    })[3]).toEqual({ label: "Activation", status: "current" })
  })

  it("shows the email address as current when reusing a verified domain", () => {
    expect(buildEmailSetupSteps({ domainVerified: true, senderConfigured: false,
      inboundEnabled: false, channelActive: false })).toEqual([
      { label: "DNS Verification", status: "complete" },
      { label: "Email Address", status: "current" },
      { label: "Inbound", status: "upcoming" },
      { label: "Activation", status: "upcoming" },
    ])
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
