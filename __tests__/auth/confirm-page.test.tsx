/**
 * @jest-environment jsdom
 */

import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import ConfirmPage from "@/app/auth/confirm/page"

const verifyOtpMock = jest.fn()
const getSessionMock = jest.fn()
const router = { push: jest.fn(), replace: jest.fn() }
const searchParams = new URLSearchParams()
const originalLocation = window.location

jest.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => searchParams,
}))

jest.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
      getSession: (...args: unknown[]) => getSessionMock(...args),
    },
  }),
}))

describe("auth confirm page", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    verifyOtpMock.mockReset()
    getSessionMock.mockReset()
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null })
    Array.from(searchParams.keys()).forEach((key) => searchParams.delete(key))
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "http://localhost/auth/confirm", hostname: "localhost" },
    })
    jest.spyOn(console, "log").mockImplementation(() => undefined)
    jest.spyOn(console, "warn").mockImplementation(() => undefined)
    jest.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    })
  })

  it("does not verify on mount and waits for a click", () => {
    searchParams.set("token_hash", "abc")
    searchParams.set("type", "magiclink")

    render(<ConfirmPage />)

    expect(screen.getByRole("button", { name: "Confirm Sign In" })).toBeInTheDocument()
    expect(verifyOtpMock).not.toHaveBeenCalled()
  })

  it("verifies only after the user clicks", async () => {
    searchParams.set("token_hash", "abc")
    searchParams.set("type", "email")
    verifyOtpMock.mockResolvedValue({
      data: { session: { access_token: "t" }, user: { user_metadata: { password_set: true } } },
      error: null,
    })

    render(<ConfirmPage />)
    fireEvent.click(screen.getByRole("button", { name: "Confirm Sign In" }))

    await waitFor(() => {
      expect(verifyOtpMock).toHaveBeenCalledWith({
        token_hash: "abc",
        type: "email",
      })
    })
  })

  it.each([
    ["auth_channel", "otp"],
    ["redirect_to", "https://www.makinari.com/auth/confirm?auth_channel=otp"],
  ])("blocks verification when the OTP channel is in %s", (key, value) => {
    searchParams.set("token_hash", "abc")
    searchParams.set(key, value)

    render(<ConfirmPage />)

    expect(screen.getByText("Checkout code required")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Confirm Sign In" })).not.toBeInTheDocument()
    expect(verifyOtpMock).not.toHaveBeenCalled()
  })

  it.each([true, false, undefined])(
    "opens password setup for recovery when password_set is %s",
    async (passwordSet) => {
      searchParams.set("token_hash", "recovery-token")
      searchParams.set("type", "recovery")
      searchParams.set("returnTo", "/buyer/orders?status=open")
      verifyOtpMock.mockResolvedValue({
        data: {
          session: { access_token: "test-token" },
          user: { user_metadata: { password_set: passwordSet } },
        },
        error: null,
      })

      render(<ConfirmPage />)
      expect(verifyOtpMock).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole("button", { name: "Reset Password" }))

      await waitFor(() => expect(verifyOtpMock).toHaveBeenCalledTimes(1))
      act(() => jest.advanceTimersByTime(3000))

      expect(verifyOtpMock).toHaveBeenCalledWith({
        token_hash: "recovery-token",
        type: "recovery",
      })
      expect(router.replace).toHaveBeenCalledWith(
        `/auth/set-password?returnTo=${encodeURIComponent("/buyer/orders?status=open")}`
      )
      expect(router.push).not.toHaveBeenCalled()
      expect(window.location.href).toBe("http://localhost/auth/confirm")
    }
  )

  it.each([
    ["https://www.makinari.com/auth/reset-password?returnTo=%2Fshop%2Facme", "/shop/acme"],
    ["https://untrusted.example/landing", "/projects"],
    ["//untrusted.example/landing", "/projects"],
    ["/auth/confirm", "/projects"],
  ])("keeps recovery return targets safe for %s", async (redirectTo, expected) => {
    searchParams.set("token_hash", "recovery-token")
    searchParams.set("type", "recovery")
    searchParams.set("redirect_to", redirectTo)
    verifyOtpMock.mockResolvedValue({
      data: { session: { access_token: "test-token" }, user: { user_metadata: { password_set: true } } },
      error: null,
    })

    render(<ConfirmPage />)
    fireEvent.click(screen.getByRole("button", { name: "Reset Password" }))

    await waitFor(() => expect(verifyOtpMock).toHaveBeenCalledTimes(1))
    act(() => jest.advanceTimersByTime(3000))

    expect(router.replace).toHaveBeenCalledWith(
      `/auth/set-password?returnTo=${encodeURIComponent(expected)}`
    )
  })

  it("continues recovery when verification establishes a session retrieved separately", async () => {
    searchParams.set("token_hash", "recovery-token")
    searchParams.set("type", "recovery")
    verifyOtpMock.mockResolvedValue({
      data: { session: null, user: { user_metadata: { password_set: true } } },
      error: null,
    })
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: "recovery-user" } } },
      error: null,
    })

    render(<ConfirmPage />)
    fireEvent.click(screen.getByRole("button", { name: "Reset Password" }))

    await waitFor(() => expect(getSessionMock).toHaveBeenCalledTimes(1))
    act(() => jest.advanceTimersByTime(3000))

    expect(router.replace).toHaveBeenCalledWith("/auth/set-password?returnTo=%2Fprojects")
  })

  it("does not process signup referrals during password recovery", async () => {
    searchParams.set("token_hash", "recovery-token")
    searchParams.set("type", "recovery")
    verifyOtpMock.mockResolvedValue({
      data: {
        session: { access_token: "test-token" },
        user: {
          user_metadata: { password_set: true },
          raw_user_meta_data: { referral_code: "existing-referral" },
        },
      },
      error: null,
    })

    render(<ConfirmPage />)
    fireEvent.click(screen.getByRole("button", { name: "Reset Password" }))

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/auth/set-password?returnTo=%2Fprojects")
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it.each(["invalid token", "expired token", "missing session"])(
    "does not open password setup for %s",
    async (failure) => {
      searchParams.set("token_hash", "recovery-token")
      searchParams.set("type", "recovery")
      verifyOtpMock.mockResolvedValue({
        data: { session: null, user: null },
        error: failure === "missing session" ? null : { message: failure },
      })

      render(<ConfirmPage />)
      fireEvent.click(screen.getByRole("button", { name: "Reset Password" }))

      await waitFor(() => expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument())
      act(() => jest.advanceTimersByTime(3000))

      expect(router.replace).not.toHaveBeenCalled()
      expect(router.push).not.toHaveBeenCalled()
      expect(window.location.href).toBe("http://localhost/auth/confirm")
    }
  )

  it("does not verify or redirect a recovery link without a token", () => {
    searchParams.set("type", "recovery")

    render(<ConfirmPage />)

    expect(screen.getByText("Missing confirmation token")).toBeInTheDocument()
    expect(verifyOtpMock).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("still sends a regular confirmation with an existing password to its return target", async () => {
    searchParams.set("token_hash", "email-token")
    searchParams.set("type", "email")
    searchParams.set("returnTo", "/buyer")
    verifyOtpMock.mockResolvedValue({
      data: { session: { access_token: "test-token" }, user: { user_metadata: { password_set: true } } },
      error: null,
    })

    render(<ConfirmPage />)
    fireEvent.click(screen.getByRole("button", { name: "Confirm Sign In" }))

    await waitFor(() => expect(screen.getByText("Email confirmed! Redirecting...")).toBeInTheDocument())
    act(() => jest.advanceTimersByTime(3000))

    expect(window.location.href).toBe("/buyer")
    expect(router.replace).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })

  it.each(["email", "invite"])("preserves password setup for %s confirmations without a password", async (type) => {
    searchParams.set("token_hash", "confirmation-token")
    searchParams.set("type", type)
    verifyOtpMock.mockResolvedValue({
      data: { session: { access_token: "test-token" }, user: { user_metadata: {} } },
      error: null,
    })

    render(<ConfirmPage />)
    fireEvent.click(screen.getByRole("button", { name: "Confirm Sign In" }))

    await waitFor(() => expect(screen.getByText(/Setting up your account/)).toBeInTheDocument())
    act(() => jest.advanceTimersByTime(3000))

    expect(router.push).toHaveBeenCalledWith("/auth/set-password?returnTo=%2Fprojects")
    expect(router.replace).not.toHaveBeenCalled()
  })
})
