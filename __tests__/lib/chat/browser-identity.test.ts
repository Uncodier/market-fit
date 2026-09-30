import { ChatIdentityCoordinator } from "@/lib/chat/browser-identity"
import { getIdentitySdk, SUPPORT_SITE_ID } from "@/lib/chat/identity-types"

const context = { siteId: SUPPORT_SITE_ID, sessionId: "widget-session", visitorId: "visitor", sessionToken: "session-proof" }
const sdk = { getIdentityContext: jest.fn(), identify: jest.fn(), logoutIdentity: jest.fn() }
const sdkGetter = jest.fn(() => sdk)
function response(userId = "user-a", status = 200) {
  return { ok: status === 200, status, json: async () => ({ success: true, data: { user_id: userId, identity_token: "transient-token" } }) }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe("browser support identity coordinator", () => {
  let coordinator: ChatIdentityCoordinator
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    sdkGetter.mockReturnValue(sdk)
    sdk.getIdentityContext.mockReset().mockResolvedValue(context)
    sdk.identify.mockReset().mockResolvedValue({ status: "verified" })
    sdk.logoutIdentity.mockReset().mockResolvedValue(undefined)
    ;(global.fetch as jest.Mock).mockReset().mockResolvedValue(response())
    coordinator = new ChatIdentityCoordinator(sdkGetter)
  })
  afterEach(() => { coordinator.cancel(); jest.useRealTimers(); delete window.Makinari; delete window.MarketFit })

  it("passes only a server-backed token; no profile lookup or email identify", async () => {
    await coordinator.sync("user-a")
    expect(sdk.logoutIdentity).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith("/api/chat/identity-token", expect.objectContaining({
      credentials: "same-origin", cache: "no-store", body: JSON.stringify({ session_id: "widget-session" }),
      headers: { "Content-Type": "application/json", "x-visitor-session-token": "session-proof" },
    }))
    expect(sdk.identify).toHaveBeenCalledWith({ identityToken: "transient-token" })
  })

  it("deduplicates concurrent initialization and refresh events for the same user/session", async () => {
    const first = coordinator.sync("user-a")
    expect(coordinator.sync("user-a")).toBe(first)
    await first
    await coordinator.sync("user-a")
    expect(sdk.identify).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("renews for a new widget session and periodically before grant expiry", async () => {
    await coordinator.sync("user-a")
    sdk.getIdentityContext.mockResolvedValue({ ...context, sessionId: "new-session" })
    await coordinator.sync("user-a")
    jest.setSystemTime(Date.now() + 10 * 60_000)
    await coordinator.sync("user-a")
    expect(sdk.identify).toHaveBeenCalledTimes(3)
  })

  it("rejects another user's response and a different site", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(response("user-b"))
    await coordinator.sync("user-a")
    expect(sdk.identify).not.toHaveBeenCalled()
    sdk.getIdentityContext.mockResolvedValue({ ...context, siteId: "other-site" })
    await coordinator.sync("user-a")
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("does not redeem if the widget session changed during issuance", async () => {
    sdk.getIdentityContext.mockResolvedValueOnce(context).mockResolvedValue({ ...context, sessionId: "changed" })
    await coordinator.sync("user-a")
    expect(sdk.identify).not.toHaveBeenCalled()
  })

  it("discards a pending issuance after logout and immediately clears local chat", async () => {
    const pending = deferred<ReturnType<typeof response>>()
    ;(global.fetch as jest.Mock).mockReturnValue(pending.promise)
    const sync = coordinator.sync("user-a")
    await jest.advanceTimersByTimeAsync(0)
    const logout = coordinator.sync(null)
    expect(sdk.logoutIdentity).toHaveBeenCalledTimes(2)
    pending.resolve(response())
    await Promise.all([sync, logout])
    expect(sdk.identify).not.toHaveBeenCalled()
  })

  it("waits for account-switch revocation before binding another identity", async () => {
    await coordinator.sync("user-a")
    const logout = deferred<void>()
    sdk.logoutIdentity.mockReturnValue(logout.promise)
    ;(global.fetch as jest.Mock).mockResolvedValue(response("user-b"))
    const switchAccount = coordinator.sync("user-b")
    await jest.advanceTimersByTimeAsync(0)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    logout.resolve()
    await switchAccount
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it("does not fall back to OTP for unavailable servers or legacy SDKs", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(response("user-a", 503))
    await coordinator.sync("user-a")
    expect(sdk.identify).not.toHaveBeenCalled()
    window.Makinari = { chat: { identify: jest.fn() } }
    expect(getIdentitySdk()).toBeUndefined()
    window.MarketFit = sdk
    window.Makinari = undefined
    expect(getIdentitySdk()).toBe(sdk)
  })

  it("fails closed until a failed server revocation can be retried", async () => {
    sdk.logoutIdentity.mockRejectedValue(new Error("offline"))
    const sync = coordinator.sync("user-a")
    await jest.advanceTimersByTimeAsync(10_000)
    await sync
    expect(global.fetch).not.toHaveBeenCalled()
    sdk.logoutIdentity.mockResolvedValue(undefined)
    await coordinator.sync("user-a")
    expect(sdk.identify).toHaveBeenCalledTimes(1)
  })

  it("clears a previously verified identity when server authentication is rejected", async () => {
    await coordinator.sync("user-a")
    jest.setSystemTime(Date.now() + 10 * 60_000)
    ;(global.fetch as jest.Mock).mockResolvedValue(response("user-a", 401))
    await coordinator.sync("user-a")
    expect(sdk.logoutIdentity).toHaveBeenCalledTimes(2)
    expect(sdk.identify).toHaveBeenCalledTimes(1)
  })

  it("bounds application logout without removing the pending revocation barrier", async () => {
    await coordinator.sync("user-a")
    const revoke = deferred<void>()
    sdk.logoutIdentity.mockReturnValue(revoke.promise)
    const logout = coordinator.clearForSignOut()
    await jest.advanceTimersByTimeAsync(3000)
    await logout
    ;(global.fetch as jest.Mock).mockResolvedValue(response("user-b"))
    const nextAccount = coordinator.sync("user-b")
    await jest.advanceTimersByTimeAsync(0)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    revoke.resolve()
    await nextAccount
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it("renews earlier when the server returns a shorter grant expiry", async () => {
    sdk.identify.mockResolvedValue({ status: "verified", expiresAt: Date.now() + 120_000 })
    await coordinator.sync("user-a")
    jest.setSystemTime(Date.now() + 61_000)
    await coordinator.sync("user-a")
    expect(sdk.identify).toHaveBeenCalledTimes(2)
  })
})