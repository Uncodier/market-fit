import { act, renderHook, waitFor } from "@testing-library/react"
import { useAuthState } from "@/app/hooks/use-auth"
import { useRouter } from "next/navigation"
import { useSupabaseClient } from "@/app/hooks/use-supabase-client"
import { SUPPORT_SITE_ID } from "@/lib/chat/identity-types"

jest.mock("@/app/hooks/use-supabase-client", () => ({ useSupabaseClient: jest.fn() }))

describe("authenticated chat initialization", () => {
  let onAuthChange: (event: string, session: unknown) => void | Promise<void>
  const user = { id: "user-a", email: "untrusted-profile@example.test", user_metadata: { name: "Editable name" } }
  const session = { user }
  const sdk = {
    getIdentityContext: jest.fn(), logoutIdentity: jest.fn(), identify: jest.fn(),
    chat: { identify: jest.fn() },
  }
  const client = { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() }, from: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    // Keep the router stable so provider updates do not resubscribe the test auth client.
    ;(useRouter as jest.Mock).mockReturnValue({ push: jest.fn(), replace: jest.fn() })
    ;(useSupabaseClient as jest.Mock).mockReturnValue(client)
    client.auth.getSession.mockResolvedValue({ data: { session }, error: null })
    client.auth.onAuthStateChange.mockImplementation((callback) => {
      onAuthChange = callback
      return { data: { subscription: { unsubscribe: jest.fn() } } }
    })
    sdk.getIdentityContext.mockResolvedValue({ siteId: SUPPORT_SITE_ID, sessionId: "widget-session", visitorId: "visitor", sessionToken: "session-proof" })
    sdk.logoutIdentity.mockResolvedValue(undefined)
    sdk.identify.mockResolvedValue({ status: "verified" })
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { user_id: "user-a", identity_token: "server-token" } }) })
    window.Makinari = sdk
  })
  afterEach(() => { delete window.Makinari })

  it("automatically identifies using only the server token without profile reads or OTP", async () => {
    const hook = renderHook(() => useAuthState())
    await waitFor(() => expect(sdk.identify).toHaveBeenCalledWith({ identityToken: "server-token" }))
    expect(hook.result.current.user?.id).toBe("user-a")
    expect(client.from).not.toHaveBeenCalled()
    expect(sdk.chat.identify).not.toHaveBeenCalled()
    expect(JSON.stringify((global.fetch as jest.Mock).mock.calls)).not.toContain(user.email)
    hook.unmount()
  })

  it("deduplicates auth refreshes and clears identity on sign-out without calling email identify", async () => {
    const hook = renderHook(() => useAuthState())
    await waitFor(() => expect(sdk.identify).toHaveBeenCalledTimes(1))
    await act(async () => { await onAuthChange("TOKEN_REFRESHED", session) })
    expect(sdk.identify).toHaveBeenCalledTimes(1)
    const logouts = sdk.logoutIdentity.mock.calls.length
    await act(async () => { await onAuthChange("SIGNED_OUT", null) })
    expect(sdk.logoutIdentity.mock.calls.length).toBeGreaterThan(logouts)
    expect(hook.result.current.user).toBeNull()
    expect(sdk.chat.identify).not.toHaveBeenCalled()
    hook.unmount()
  })

  it("releases the auth callback before syncing an updated profile", async () => {
    const hook = renderHook(() => useAuthState())
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
    client.auth.getSession.mockClear()
    const eq = jest.fn().mockResolvedValue({ error: null })
    const update = jest.fn().mockReturnValue({ eq })
    client.from.mockReturnValue({ update })
    const updatedUser = { ...user, email: "updated@example.test" }

    act(() => {
      // Supabase awaits this callback while holding its session lock.
      expect(onAuthChange("USER_UPDATED", { user: updatedUser })).toBeUndefined()
      expect(client.auth.getSession).not.toHaveBeenCalled()
      expect(client.from).not.toHaveBeenCalled()
    })

    await waitFor(() => expect(eq).toHaveBeenCalledWith("id", user.id))
    expect(update).toHaveBeenCalledWith({ email: updatedUser.email })
    expect(hook.result.current.user?.email).toBe(updatedUser.email)
    hook.unmount()
  })

  it("does not hold the auth callback while optional chat logout is pending", async () => {
    const hook = renderHook(() => useAuthState())
    await waitFor(() => expect(sdk.identify).toHaveBeenCalledTimes(1))
    sdk.logoutIdentity.mockReturnValue(new Promise(() => {}))
    act(() => {
      expect(onAuthChange("SIGNED_OUT", null)).toBeUndefined()
    })
    expect(hook.result.current.user).toBeNull()
    hook.unmount()
  })

  it("discards a queued profile sync after sign-out", async () => {
    const hook = renderHook(() => useAuthState())
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
    client.from.mockClear()
    act(() => {
      onAuthChange("USER_UPDATED", session)
      onAuthChange("SIGNED_OUT", null)
    })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    expect(client.from).not.toHaveBeenCalled()
    expect(hook.result.current.user).toBeNull()
    hook.unmount()
  })

  it("cancels a queued profile sync on unmount", async () => {
    const hook = renderHook(() => useAuthState())
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
    client.from.mockClear()
    act(() => { onAuthChange("USER_UPDATED", session) })
    hook.unmount()
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    expect(client.from).not.toHaveBeenCalled()
  })
})