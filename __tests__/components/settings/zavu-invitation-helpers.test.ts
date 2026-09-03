import {
  hasConnectionChanged,
  mapInvitationStatus,
  mapInvitationToConnection,
  shouldSyncInvitation,
} from "@/app/components/settings/zavu-invitation-helpers"

describe("mapInvitationStatus", () => {
  it("maps completed to connected", () => {
    expect(mapInvitationStatus("completed")).toBe("connected")
  })

  it("keeps in_progress, failed, and pending", () => {
    expect(mapInvitationStatus("in_progress")).toBe("in_progress")
    expect(mapInvitationStatus("failed")).toBe("failed")
    expect(mapInvitationStatus("pending")).toBe("pending")
    expect(mapInvitationStatus(undefined)).toBe("pending")
  })
})

describe("shouldSyncInvitation", () => {
  it("syncs pending WhatsApp invitations", () => {
    expect(
      shouldSyncInvitation({
        type: "whatsapp",
        status: "pending",
        zavu_invitation_id: "inv_1",
      })
    ).toBe(true)
  })

  it("does not sync a connected channel", () => {
    expect(
      shouldSyncInvitation({
        type: "whatsapp",
        status: "connected",
        zavu_invitation_id: "inv_1",
      })
    ).toBe(false)
  })

  it("does not sync telegram or channels without invitation id", () => {
    expect(shouldSyncInvitation({ type: "telegram", status: "pending" })).toBe(false)
    expect(shouldSyncInvitation({ type: "whatsapp", status: "pending" })).toBe(false)
  })
})

describe("mapInvitationToConnection", () => {
  const channel = {
    id: "ch_1",
    type: "whatsapp",
    name: "WhatsApp",
    status: "pending",
    zavu_invitation_id: "inv_1",
    metadata: { invitation_url: "https://dashboard.zavu.dev/invite/abc" },
  }

  it("maps a completed invitation onto the connection", () => {
    const next = mapInvitationToConnection(
      {
        id: "inv_1",
        status: "completed",
        senderId: "snd_1",
        connectedAccount: { channel: "whatsapp", id: "pn_1", name: "Acme Shop" },
      },
      channel
    )

    expect(next.status).toBe("connected")
    expect(next.zavu_sender_id).toBe("snd_1")
    expect(next.name).toBe("Acme Shop")
    expect(next.connected_account).toEqual({
      channel: "whatsapp",
      id: "pn_1",
      name: "Acme Shop",
    })
    expect(hasConnectionChanged(channel, next)).toBe(true)
  })

  it("keeps pending unchanged when the invitation is still pending", () => {
    const next = mapInvitationToConnection({ id: "inv_1", status: "pending" }, channel)
    expect(next.status).toBe("pending")
    expect(hasConnectionChanged(channel, next)).toBe(false)
  })

  it("stores a failure reason without dropping the invitation url", () => {
    const next = mapInvitationToConnection(
      { id: "inv_1", status: "failed", failureReason: "fb_cancelled" },
      channel
    )
    expect(next.status).toBe("failed")
    expect(next.metadata).toEqual({
      invitation_url: "https://dashboard.zavu.dev/invite/abc",
      failure_reason: "fb_cancelled",
    })
  })
})
