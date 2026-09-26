import { getWorkflowConnectionLabel } from "@/app/components/workflows/workflow-connection-label"

describe("workflow connection labels", () => {
  it("uses the connected phone number instead of the channel's generic name", () => {
    expect(getWorkflowConnectionLabel({
      id: "wa-1", type: "whatsapp", metadata: { phone_number: "+14155550100" },
    })).toBe("WhatsApp · +1 (415) 555-0100")
    expect(getWorkflowConnectionLabel({ id: "sms-1", type: "sms", connected_account: { phoneNumber: "+525512345678" } }))
      .toBe("SMS · +52 55 1234 5678")
    expect(getWorkflowConnectionLabel({ id: "voice-1", type: "voice", zavu_sender_id: "sender-1" }, "+14155550200"))
      .toBe("Voice · +1 (415) 555-0200")
  })

  it("shows email address and Telegram username from saved metadata", () => {
    expect(getWorkflowConnectionLabel({ id: "email-1", type: "email", metadata: { from_address: "help@example.com" } }))
      .toBe("Email · help@example.com")
    expect(getWorkflowConnectionLabel({ id: "tg-1", type: "telegram", metadata: { bot_username: "@acme_support" } }))
      .toBe("Telegram · @acme_support")
  })

  it("uses account identifiers or the full connection ID when account details are absent", () => {
    expect(getWorkflowConnectionLabel({ id: "messenger-1", type: "messenger", connected_account: { id: "page-987", name: "Messenger" } }))
      .toBe("Messenger · page-987")
    expect(getWorkflowConnectionLabel({ id: "connection-abcdef", type: "email" }))
      .toBe("Email · connection-abcdef")
  })
})