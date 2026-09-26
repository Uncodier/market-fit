import {
  isEmailChannelActive,
  resolveEmailReceivingEnabled,
} from "@/app/components/settings/email-channel-utils"

describe("email channel helpers", () => {
  it("uses the sender value returned by Zavu", () => {
    expect(resolveEmailReceivingEnabled(
      { sender: { emailReceivingEnabled: false } }
    )).toBe(false)
  })

  it("uses a top-level receiving value when returned", () => {
    expect(resolveEmailReceivingEnabled(
      { emailReceivingEnabled: true }
    )).toBe(true)
  })

  it("does not assume success without a sender snapshot", () => {
    expect(resolveEmailReceivingEnabled(
      { message: "Email sender updated successfully" }
    )).toBeUndefined()
  })

  it("detects an activated email channel in sender responses", () => {
    expect(isEmailChannelActive({ sender: { channels: ["email"] } })).toBe(true)
    expect(isEmailChannelActive({ channels: [] })).toBe(false)
  })
})
