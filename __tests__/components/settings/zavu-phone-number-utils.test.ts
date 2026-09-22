import {
  buildAvailablePhoneNumbersQuery,
  canAssignPhoneNumber,
  createPhoneConnectionMetadata,
  filterPhoneNumbersForSite,
  formatPhoneCapabilities,
  formatPhoneNumber,
  getAssignedPhoneNumber,
  getZavuSenderPhoneNumber,
  getVoiceConnectionSuccessMessage,
  getVoiceConnectionStatus,
  hasPhoneCapability,
  reconcilePhoneConnections,
  unwrapPurchasedPhoneNumber,
  unwrapZavuItems,
} from "@/app/components/settings/zavu-phone-number-utils"

describe("zavu phone number helpers", () => {
  it("formats phone numbers for readable display", () => {
    expect(formatPhoneNumber("+14155550100")).toBe("+1 (415) 555-0100")
    expect(formatPhoneNumber("+525512345678")).toBe("+52 55 1234 5678")
    expect(formatPhoneNumber("+442071838750")).toBe("+44 207 183 8750")
    expect(formatPhoneNumber("4155550100")).toBe("415 555 0100")
  })

  it("reads assigned numbers from persisted connections and sender responses", () => {
    expect(getAssignedPhoneNumber({
      metadata: { phone_number: "+14155550100" },
    })).toBe("+14155550100")
    expect(getAssignedPhoneNumber({
      connected_account: { phoneNumber: "+14155550200" },
    })).toBe("+14155550200")
    expect(getZavuSenderPhoneNumber({
      sender: {
        phoneNumber: "+14155550300",
        whatsapp: { displayPhoneNumber: "+14155550400" },
      },
    })).toBe("+14155550400")
  })

  it("supports documented and legacy list response shapes", () => {
    const items = [{ id: "pn_1", phoneNumber: "+14155550100" }]

    expect(unwrapZavuItems({ items })).toEqual(items)
    expect(unwrapZavuItems(items)).toEqual(items)
    expect(unwrapZavuItems(undefined)).toEqual([])
  })

  it("builds the documented available-number query", () => {
    const query = new URLSearchParams(buildAvailablePhoneNumbersQuery({
      countryCode: "US",
      type: "local",
      contains: "415",
      capabilities: ["sms", "voice"],
    }))

    expect(query.get("countryCode")).toBe("US")
    expect(query.get("type")).toBe("local")
    expect(query.get("contains")).toBe("415")
    expect(query.get("capabilities")).toBe("sms,voice")
    expect(query.getAll("capabilities")).toHaveLength(1)
  })

  it("normalizes capability response shapes", () => {
    expect(formatPhoneCapabilities(["sms", "voice"])).toEqual(["sms", "voice"])
    expect(formatPhoneCapabilities({ sms: true, voice: false, mms: true })).toEqual(["sms", "mms"])
    expect(hasPhoneCapability({ phoneNumber: "+1", capabilities: { sms: true } }, "sms")).toBe(true)
    expect(canAssignPhoneNumber({
      phoneNumber: "+1",
      capabilities: ["sms"],
      status: "active",
      regulatoryStatus: "approved",
    }, "sms")).toBe(true)
    expect(canAssignPhoneNumber({
      phoneNumber: "+1",
      capabilities: ["sms"],
      status: "active",
      regulatoryStatus: "rejected",
    }, "sms")).toBe(false)
  })

  it("unwraps a purchased number and creates stable routing metadata", () => {
    const purchased = unwrapPurchasedPhoneNumber({
      phoneNumber: {
        id: "pn_1",
        phoneNumber: "+14155550100",
        capabilities: ["sms", "voice"],
        regulatoryStatus: "approved",
      },
    })

    expect(purchased?.id).toBe("pn_1")
    expect(createPhoneConnectionMetadata({
      channel: "sms",
      selected: { phoneNumber: "+14155550100" },
      purchased,
      responseData: { senderId: "snd_1" },
    })).toEqual({
      senderId: "snd_1",
      phoneNumber: "+14155550100",
      phoneNumberId: "pn_1",
      channel: "sms",
      capabilities: ["sms", "voice"],
      regulatoryStatus: "approved",
    })
  })

  it("keeps Voice in progress while its agent is inactive", () => {
    expect(getVoiceConnectionStatus({
      agentEnabled: false,
      regulatoryStatus: "approved",
    })).toBe("pending")
    expect(getVoiceConnectionStatus({
      agentEnabled: true,
      regulatoryStatus: "approved",
    })).toBe("connected")
    expect(getVoiceConnectionSuccessMessage("pending")).toBe(
      "Number reserved. Activate the Customer Support agent to enable Voice."
    )
    expect(getVoiceConnectionSuccessMessage("pending")).not.toContain(
      "connected successfully"
    )
  })

  it("reconciles all connections from the authoritative backend response", () => {
    const staleConnections = [{
      id: "voice-1",
      type: "voice",
      status: "pending",
      zavu_sender_id: "sender_old",
    }, {
      id: "sms-1",
      type: "sms",
      status: "connected",
      zavu_sender_id: "sender_old",
    }]
    const canonicalConnections = [{
      id: "voice-1",
      type: "voice",
      status: "connected",
      zavu_sender_id: "sender_new",
      metadata: { activation_pending: false },
    }, {
      id: "sms-1",
      type: "sms",
      status: "connected",
      zavu_sender_id: "sender_new",
    }]

    expect(reconcilePhoneConnections(staleConnections, 0, {
      connections: canonicalConnections,
    })).toEqual(canonicalConnections)
  })

  it("hides numbers assigned to active channels on another site", () => {
    const numbers = [
      { id: "pn_other", phoneNumber: "+14155550100" },
      { id: "pn_free", phoneNumber: "+14155550200" },
    ]

    expect(filterPhoneNumbersForSite(numbers, [
      {
        site_id: "site_other",
        channels: {
          connections: [{
            status: "connected",
            metadata: { phone_number_id: "pn_other", phone_number: "+14155550100" },
          }],
        },
      },
    ], "site_current")).toEqual([numbers[1]])
  })

  it("hides numbers reserved by pending channels on another site", () => {
    const numbers = [{ id: "pn_pending", phoneNumber: "+14155550100" }]

    expect(filterPhoneNumbersForSite(numbers, [{
      site_id: "site_other",
      channels: {
        connections: [{
          status: "pending",
          metadata: { phone_number_id: "pn_pending" },
        }],
      },
    }], "site_current")).toEqual([])
  })

  it("keeps numbers assigned to the current site or inactive channels", () => {
    const numbers = [{ id: "pn_1", phoneNumber: "+14155550100" }]

    expect(filterPhoneNumbersForSite(numbers, [
      {
        site_id: "site_current",
        channels: JSON.stringify({
          connections: [{
            status: "connected",
            metadata: { routing: { phone_number_id: "pn_1" } },
          }],
        }),
      },
      {
        site_id: "site_other",
        channels: {
          connections: [{
            status: "disconnected",
            metadata: { phone_number: "+14155550100" },
          }],
        },
      },
    ], "site_current")).toEqual(numbers)
  })
})
