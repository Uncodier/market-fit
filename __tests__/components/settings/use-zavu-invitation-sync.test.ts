import { act, renderHook } from "@testing-library/react"
import { useZavuInvitationSync } from "@/app/components/settings/use-zavu-invitation-sync"
import type { SiteFormValues } from "@/app/components/settings/form-schema"
import { toast } from "sonner"

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
        siteId: "site-1",
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

    expect(getMock).toHaveBeenCalledWith("/api/integrations/zavu/invitations/inv_1?siteId=site-1")
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
        siteId: "site-1",
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
        siteId: "site-1",
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

    expect(getMock).toHaveBeenCalledWith("/api/integrations/zavu/invitations/inv_1?siteId=site-1")
  })

  it("does not fetch when the channel is already connected", async () => {
    renderHook(() =>
      useZavuInvitationSync({
        siteId: "site-1",
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

  it.each([
    { success: false, status: 502, error: { message: "Activation failed" }, data: { invitation: { status: "completed" } } },
    { success: true, data: { invitation: { status: "completed", activationPending: true, senderId: "snd_1" } } },
  ])("does not connect or persist incomplete activation (%#)", async (response) => {
    getMock.mockResolvedValue(response)
    const update = jest.fn()
    const onSave = jest.fn()
    const { result } = renderHook(() => useZavuInvitationSync({
      siteId: "site-1", connections: [pendingChannel], enabled: true, update,
      getValues: () => formValues([pendingChannel]), onSave,
    }))
    await act(async () => { await result.current.checkStatus() })
    expect(update).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "connected" }))
    expect(onSave).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    if (!response.success) expect(toast.error).toHaveBeenCalledWith("Activation failed")
  })

  it("uses the same encoded site query for manual status checks", async () => {
    getMock.mockResolvedValue({ success: true, data: { invitation: { status: "pending" } } })
    const { result } = renderHook(() => useZavuInvitationSync({
      siteId: "site/one", connections: [{ ...pendingChannel, zavu_invitation_id: "inv/one" }],
      enabled: true, update: jest.fn(), getValues: () => formValues([]),
    }))
    await act(async () => { await result.current.checkStatus() })
    getMock.mockClear()
    await act(async () => { await result.current.checkStatus() })
    expect(getMock).toHaveBeenCalledWith("/api/integrations/zavu/invitations/inv%2Fone?siteId=site%2Fone")
  })

  it("allows a failed activation to be checked again and connect only after success", async () => {
    getMock.mockResolvedValueOnce({ success: false, status: 502 })
      .mockResolvedValueOnce({ success: true, data: { invitation: { status: "completed", activationPending: false, senderId: "snd_1" } } })
    const update = jest.fn()
    const { result } = renderHook(() => useZavuInvitationSync({
      siteId: "site-1", connections: [pendingChannel], enabled: true, update, getValues: () => formValues([]),
    }))
    await act(async () => { await result.current.checkStatus() })
    expect(update).not.toHaveBeenCalled()
    await act(async () => { await result.current.checkStatus() })
    expect(update).toHaveBeenCalledWith(0, expect.objectContaining({ status: "connected" }))
    expect(toast.success).toHaveBeenCalledTimes(1)
  })

  it.each([{ siteId: undefined, enabled: true }, { siteId: "site-1", enabled: false }])(
    "does not poll or manually fetch without an enabled site (%#)", async (scope) => {
      const { result } = renderHook(() => useZavuInvitationSync({
        ...scope, connections: [pendingChannel], update: jest.fn(), getValues: () => formValues([]),
      }))
      await act(async () => { await result.current.checkStatus() })
      expect(getMock).not.toHaveBeenCalled()
    },
  )

  it("ignores a completion from the previously selected site", async () => {
    let resolveOld!: (value: unknown) => void
    getMock.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      .mockResolvedValue({ success: true, data: { invitation: { status: "pending" } } })
    const update = jest.fn()
    const { rerender } = renderHook(({ siteId }) => useZavuInvitationSync({
      siteId, connections: [pendingChannel], enabled: true, update, getValues: () => formValues([]),
    }), { initialProps: { siteId: "site-old" } })
    rerender({ siteId: "site-new" })
    await act(async () => {
      resolveOld({ success: true, data: { invitation: { status: "completed" } } })
    })
    expect(update).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(getMock).toHaveBeenCalledWith("/api/integrations/zavu/invitations/inv_1?siteId=site-new")
  })
})
