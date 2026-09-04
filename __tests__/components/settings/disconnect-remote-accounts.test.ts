import { disconnectOutstandSocial, disconnectZavuChannel } from "@/app/components/settings/disconnect-remote-accounts"

const deleteMock = jest.fn()

jest.mock("@/app/services/api-client-service", () => ({
  apiClient: {
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}))

describe("disconnectZavuChannel", () => {
  beforeEach(() => {
    deleteMock.mockReset()
  })

  it("deletes the Zavu sender when present", async () => {
    deleteMock.mockResolvedValue({ success: true })
    await disconnectZavuChannel({ zavu_sender_id: "snd_1", zavu_invitation_id: "inv_1" })
    expect(deleteMock).toHaveBeenCalledWith("/api/integrations/zavu/senders/snd_1")
    expect(deleteMock).toHaveBeenCalledTimes(1)
  })

  it("cancels the invitation when there is no sender", async () => {
    deleteMock.mockResolvedValue({ success: true })
    await disconnectZavuChannel({ zavu_invitation_id: "inv_1" })
    expect(deleteMock).toHaveBeenCalledWith("/api/integrations/zavu/invitations/inv_1")
  })

  it("treats 404 as already disconnected", async () => {
    deleteMock.mockResolvedValue({ success: false, status: 404, error: { message: "Not found" } })
    await expect(disconnectZavuChannel({ zavu_sender_id: "snd_gone" })).resolves.toBeUndefined()
  })

  it("throws when Zavu delete fails", async () => {
    deleteMock.mockResolvedValue({ success: false, status: 500, error: { message: "Zavu down" } })
    await expect(disconnectZavuChannel({ zavu_sender_id: "snd_1" })).rejects.toThrow("Zavu down")
  })
})

describe("disconnectOutstandSocial", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("skips demo sites", async () => {
    await disconnectOutstandSocial({ id: "acc_1" }, "demo-site")
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("skips accounts without an Outstand id", async () => {
    await disconnectOutstandSocial({ id: undefined }, "site-1")
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("deletes the Outstand account through the Next.js proxy", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) })
    await disconnectOutstandSocial({ id: "acc_1" }, "site-1")
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/social/accounts/acc_1"),
      { method: "DELETE" }
    )
  })
})
