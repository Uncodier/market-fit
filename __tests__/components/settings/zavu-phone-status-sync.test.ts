import { applyRegulatoryStatuses } from "@/app/components/settings/use-zavu-phone-status-sync"

describe("applyRegulatoryStatuses", () => {
  const pendingConnection = {
    type: "sms",
    status: "in_progress",
    zavu_sender_id: "snd_1",
    metadata: {
      phone_number_id: "pn_1",
      phone_number: "+14155550100",
      regulatory_status: "pending_review",
    },
  }

  it("connects a channel after regulatory approval", () => {
    const result = applyRegulatoryStatuses([pendingConnection], [{
      id: "pn_1",
      phoneNumber: "+14155550100",
      regulatoryStatus: "approved",
    }])

    expect(result.changed).toBe(true)
    expect(result.connections[0]).toMatchObject({
      status: "connected",
      metadata: { regulatory_status: "approved" },
    })
  })

  it("marks a rejected regulatory review as failed", () => {
    const result = applyRegulatoryStatuses([pendingConnection], [{
      id: "pn_1",
      phoneNumber: "+14155550100",
      regulatoryStatus: "rejected",
    }])

    expect(result.changed).toBe(true)
    expect(result.connections[0]).toMatchObject({
      status: "failed",
      metadata: {
        regulatory_status: "rejected",
        failure_reason: "Phone number regulatory review was rejected.",
      },
    })
  })

  it("leaves unrelated connections unchanged", () => {
    const result = applyRegulatoryStatuses([pendingConnection], [{
      id: "pn_other",
      phoneNumber: "+14155550999",
      regulatoryStatus: "approved",
    }])

    expect(result.changed).toBe(false)
    expect(result.connections[0]).toBe(pendingConnection)
  })
})
