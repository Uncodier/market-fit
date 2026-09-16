import {
  isEmailChannelActive,
  resolveEmailReceivingEnabled,
} from "@/app/components/settings/email-channel-utils"

describe("email channel helpers", () => {
  it("uses the sender value returned by Zavu", () => {
    expect(resolveEmailReceivingEnabled(
      { sender: { emailReceivingEnabled: false } },
      true
    )).toBe(false)
  })

  it("uses a top-level receiving value when returned", () => {
    expect(resolveEmailReceivingEnabled(
      { emailReceivingEnabled: true },
      false
    )).toBe(true)
  })

  it("accepts a successful response without a sender snapshot", () => {
    expect(resolveEmailReceivingEnabled(
      { message: "Email sender updated successfully" },
      true
    )).toBe(true)
  })

  it("detects an activated email channel in sender responses", () => {
    expect(isEmailChannelActive({ sender: { channels: ["email"] } })).toBe(true)
    expect(isEmailChannelActive({ channels: [] })).toBe(false)
  })
})
