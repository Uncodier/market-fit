/**
 * @jest-environment jsdom
 */

import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AuthForm } from "@/app/components/auth/auth-form"

const signUp = jest.fn()
const signInWithPassword = jest.fn()
const resetPasswordForEmail = jest.fn()
const listFactors = jest.fn()
const challenge = jest.fn()
const verify = jest.fn()
const auth = {
  signUp,
  signInWithPassword,
  resetPasswordForEmail,
  signInWithOAuth: jest.fn(),
  signOut: jest.fn().mockResolvedValue({ error: null }),
  getSession: jest.fn(),
  mfa: { listFactors, challenge, verify },
}
const supabase = {
  auth,
  rpc: jest.fn().mockResolvedValue({ data: false, error: null }),
}

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => supabase,
}))

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: () => "" }),
}))

describe("AuthForm behavior", () => {
  let consoleLog: jest.SpiedFunction<typeof console.log>

  beforeEach(() => {
    jest.clearAllMocks()
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => undefined)
    signUp.mockResolvedValue({
      data: { user: { email_confirmed_at: null } },
      error: null,
    })
    resetPasswordForEmail.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    consoleLog.mockRestore()
  })

  it("signs up directly without an account-existence preflight", async () => {
    const fetchSpy = jest.spyOn(global, "fetch")
    render(<AuthForm defaultAuthType="signup" isShopContext />)

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "new@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret1" },
    })
    fireEvent.change(screen.getByLabelText(/Phone number/), {
      target: { value: "+1 555 000 0000" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }))

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "new@example.com",
          options: expect.objectContaining({
            data: expect.objectContaining({ phone: "+1 555 000 0000" }),
          }),
        })
      )
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it("starts an MFA challenge when password auth has no session", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1" }, session: null },
      error: null,
    })
    listFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-1", verified: true }] },
      error: null,
    })
    challenge.mockResolvedValue({
      data: { id: "challenge-1" },
      error: null,
    })
    render(<AuthForm isShopContext />)

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "user@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret1" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }))

    await waitFor(() => {
      expect(challenge).toHaveBeenCalledWith({ factorId: "factor-1" })
    })
    expect(
      screen.getByText("Enter verification code")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("textbox", { name: "Verification code" })
    ).toHaveAttribute("autocomplete", "one-time-code")
  })

  it("keeps the password visibility control keyboard-accessible", () => {
    render(<AuthForm isShopContext />)

    const password = screen.getByLabelText("Password")
    const toggle = screen.getByRole("button", { name: "Show password" })

    expect(toggle).not.toHaveAttribute("tabindex", "-1")
    fireEvent.click(toggle)
    expect(password).toHaveAttribute("type", "text")
    expect(
      screen.getByRole("button", { name: "Hide password" })
    ).toHaveAttribute("aria-pressed", "true")
  })

  it("switches to reset mode and requests a reset email", async () => {
    render(<AuthForm isShopContext />)
    fireEvent.click(
      screen.getByRole("button", { name: "Forgot password?" })
    )
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "user@example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send Reset Link" }))

    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledWith(
        "user@example.com",
        expect.objectContaining({
          redirectTo: expect.stringContaining("/auth/reset-password"),
        })
      )
    })
  })
})
