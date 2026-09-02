/**
 * @jest-environment jsdom
 */

import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import ConfirmPage from "@/app/auth/confirm/page"

const verifyOtpMock = jest.fn()
const searchParams = new URLSearchParams()

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({
    get: (key: string) => searchParams.get(key),
  }),
}))

jest.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
    },
  }),
}))

describe("auth confirm page", () => {
  beforeEach(() => {
    verifyOtpMock.mockReset()
    Array.from(searchParams.keys()).forEach((key) => searchParams.delete(key))
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

  it("blocks verification when auth_channel=otp is on the URL", () => {
    searchParams.set("token_hash", "abc")
    searchParams.set("auth_channel", "otp")

    render(<ConfirmPage />)

    expect(screen.getByText("Checkout code required")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Confirm Sign In" })).not.toBeInTheDocument()
    expect(verifyOtpMock).not.toHaveBeenCalled()
  })
})
