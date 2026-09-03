import { act, renderHook } from "@testing-library/react"
import { useZavuInvitationSync } from "@/app/components/settings/use-zavu-invitation-sync"
import type { SiteFormValues } from "@/app/components/settings/form-schema"

const getMock = jest.fn()

jest.mock("@/app/services/api-client-service", () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}))

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

const pendingChannel = {
  id: "ch_1",
  type: "whatsapp",
  name: "WhatsApp",
  status: "pending",
  zavu_invitation_id: "inv_1",
  metadata: { invitation_url: "https://dashboard.zavu.dev/invite/abc" },
}

function formValues(connections: unknown[]): SiteFormValues {
  return { channels: { connections } } as SiteFormValues
}

describe("useZavuInvitationSync", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
  })

  it("updates a pending channel when the invitation is completed", async () => {
    getMock.mockResolvedValue({
      success: true,
      data: {
        invitation: {
          id: "inv_1",
          status: "completed",
          senderId: "snd_1",
          connectedAccount: { channel: "whatsapp", id: "pn_1", name: "Acme" },
        },
      },
    })

    const update = jest.fn()
    const onSave = jest.fn()
    const connections = [pendingChannel]

    renderHook(() =>
      useZavuInvitationSync({
        connections,
        enabled: true,
        update,
        getValues: () => formValues(connections),
        onSave,
      })
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(getMock).toHaveBeenCalledWith("/api/integrations/zavu/invitations/inv_1")
    expect(update).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        status: "connected",
        zavu_sender_id: "snd_1",
        name: "Acme",
      })
    )
    expect(onSave).not.toHaveBeenCalled()
  })

  it("persists a failed invitation so the reason survives a later save", async () => {
    getMock.mockResolvedValue({
      success: true,
      data: {
        invitation: {
          id: "inv_1",
          status: "failed",
          failureReason: "fb_cancelled",
        },
      },
    })

    const onSave = jest.fn()
    const connections = [pendingChannel]

    renderHook(() =>
      useZavuInvitationSync({
        connections,
        enabled: true,
        update: jest.fn(),
        getValues: () => formValues(connections),
        onSave,
      })
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalled()
  })

  it("fetches again when the tab becomes visible", async () => {
    getMock.mockResolvedValue({
      success: true,
      data: { invitation: { id: "inv_1", status: "pending" } },
    })

    renderHook(() =>
      useZavuInvitationSync({
        connections: [pendingChannel],
        enabled: true,
        update: jest.fn(),
        getValues: () => formValues([pendingChannel]),
      })
    )

    await act(async () => {
      await Promise.resolve()
    })
    getMock.mockClear()

    await act(async () => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      })
      document.dispatchEvent(new Event("visibilitychange"))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(getMock).toHaveBeenCalledWith("/api/integrations/zavu/invitations/inv_1")
  })

  it("does not fetch when the channel is already connected", async () => {
    renderHook(() =>
      useZavuInvitationSync({
        connections: [
          {
            ...pendingChannel,
            status: "connected",
            zavu_sender_id: "snd_1",
          },
        ],
        enabled: true,
        update: jest.fn(),
        getValues: () => formValues([]),
      })
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(getMock).not.toHaveBeenCalled()
  })
})
