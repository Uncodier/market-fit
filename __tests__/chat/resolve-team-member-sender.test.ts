import { resolveTeamMemberSender } from "@/app/components/chat/resolveTeamMemberSender"

const senderId = "541396e1-a904-4a81-8cbf-0ca4e3b8b2b4"

describe("resolveTeamMemberSender", () => {
  it("uses profile cache when custom_data is empty", () => {
    const result = resolveTeamMemberSender(
      { sender_id: senderId },
      {
        userDataCache: {
          [senderId]: {
            name: "Sergio Prado",
            avatar_url: "https://example.com/avatar.jpeg",
          },
        },
      }
    )

    expect(result.name).toBe("Sergio Prado")
    expect(result.avatar).toBe("https://example.com/avatar.jpeg")
    expect(result.initials).toBe("SP")
  })

  it("falls back to the current user when the sender is the logged-in member", () => {
    const result = resolveTeamMemberSender(
      { sender_id: senderId },
      {
        currentUserId: senderId,
        currentUserName: "Sergio Prado",
        currentUserAvatar: "https://example.com/me.jpeg",
        userDataCache: {},
      }
    )

    expect(result.name).toBe("Sergio Prado")
    expect(result.avatar).toBe("https://example.com/me.jpeg")
    expect(result.initials).toBe("SP")
  })

  it("uses You when the current user has no name or profile yet", () => {
    const result = resolveTeamMemberSender(
      { sender_id: senderId },
      {
        currentUserId: senderId,
        userDataCache: {},
      }
    )

    expect(result.name).toBe("You")
    expect(result.initials).toBe("Y")
  })

  it("does not use truncated sender ids as display name when a profile exists", () => {
    const result = resolveTeamMemberSender(
      { sender_id: senderId },
      {
        currentUserId: senderId,
        userDataCache: {
          [senderId]: { name: "Sergio Prado", avatar_url: null },
        },
      }
    )

    expect(result.name).toBe("Sergio Prado")
    expect(result.initials).toBe("SP")
  })
})
