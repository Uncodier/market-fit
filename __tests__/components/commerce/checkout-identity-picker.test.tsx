/**
 * @jest-environment jsdom
 */

import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CheckoutIdentityPicker } from "@/app/components/commerce/CheckoutIdentityPicker"

const signInWithOtpMock = jest.fn()
const verifyOtpMock = jest.fn()
const toastSuccess = jest.fn()
const toastError = jest.fn()

jest.mock("../../../lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtpMock(...args),
      verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
    },
  }),
}))

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({
    t: (key: string) => key,
    locale: "en",
  }),
}))

jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

function renderPicker(
  overrides: Partial<React.ComponentProps<typeof CheckoutIdentityPicker>> = {}
) {
  const props = {
    session: null,
    requiresAuth: false,
    customerName: "",
    setCustomerName: jest.fn(),
    customerEmail: "",
    setCustomerEmail: jest.fn(),
    ...overrides,
  }
  return render(<CheckoutIdentityPicker {...props} />)
}

describe("CheckoutIdentityPicker", () => {
  beforeEach(() => {
    signInWithOtpMock.mockReset()
    verifyOtpMock.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
  })

  it("shows guest fields by default when auth is optional", () => {
    renderPicker()
    expect(screen.getByPlaceholderText("Jane Doe")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("jane@example.com")).toBeInTheDocument()
  })

  it("leaves the tabs tree and shows the code form after OTP is sent", async () => {
    signInWithOtpMock.mockResolvedValue({ error: null })

    renderPicker({ requiresAuth: true, ownerSiteId: "test-site-id" })

    const email = screen.getByPlaceholderText("jane@example.com")
    fireEvent.change(email, { target: { value: "buyer@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "checkout.identity.sendCode" }))

    await waitFor(() => {
      expect(signInWithOtpMock).toHaveBeenCalledWith({
        email: "buyer@example.com",
        options: { 
          shouldCreateUser: true,
          emailRedirectTo: expect.stringContaining("auth_channel=otp"),
          data: {
            auth_channel: "otp",
            locale: "en",
            site_id: "test-site-id"
          }
        },
      })
    })

    expect(await screen.findByText("checkout.identity.verification")).toBeInTheDocument()
    expect(screen.getByText("buyer@example.com")).toBeInTheDocument()
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
    expect(toastSuccess).toHaveBeenCalledWith("checkout.identity.emailVerification")
  })

  it("does not send OTP for an invalid email", () => {
    renderPicker({ requiresAuth: true })

    fireEvent.change(screen.getByPlaceholderText("jane@example.com"), {
      target: { value: "not-an-email" },
    })
    fireEvent.click(screen.getByRole("button", { name: "checkout.identity.sendCode" }))

    expect(signInWithOtpMock).not.toHaveBeenCalled()
  })

  it("falls back to magiclink and signup types on verifyOtp error", async () => {
    signInWithOtpMock.mockResolvedValue({ error: null })
    verifyOtpMock
      .mockResolvedValueOnce({ data: null, error: new Error("invalid") })
      .mockResolvedValueOnce({ data: null, error: new Error("invalid") })
      .mockResolvedValueOnce({ data: { session: { user: { email: "buyer@example.com" } } }, error: null })

    renderPicker({ requiresAuth: true })

    const email = screen.getByPlaceholderText("jane@example.com")
    fireEvent.change(email, { target: { value: "buyer@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "checkout.identity.sendCode" }))

    await screen.findByText("checkout.identity.verification")

    const verifyBtn = screen.getByRole("button", { name: "checkout.identity.verify" })
    
    // Fill in OTP code 
    // The CheckoutOtpCodeForm spreads the code into 6 inputs
    const inputs = screen.getAllByRole("textbox")
    inputs.forEach((input, idx) => {
      fireEvent.change(input, { target: { value: String(idx) } })
    })

    fireEvent.click(verifyBtn)

    await waitFor(() => {
      expect(verifyOtpMock).toHaveBeenNthCalledWith(1, { email: "buyer@example.com", token: "012345", type: "email" })
      expect(verifyOtpMock).toHaveBeenNthCalledWith(2, { email: "buyer@example.com", token: "012345", type: "magiclink" })
      expect(verifyOtpMock).toHaveBeenNthCalledWith(3, { email: "buyer@example.com", token: "012345", type: "signup" })
      expect(toastSuccess).toHaveBeenCalledWith("checkout.identity.signedIn")
    })
  })

  it("accepts a 6-digit autofill code on the first input", async () => {
    signInWithOtpMock.mockResolvedValue({ error: null })
    renderPicker({ requiresAuth: true })
    
    const email = screen.getByPlaceholderText("jane@example.com")
    fireEvent.change(email, { target: { value: "buyer@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "checkout.identity.sendCode" }))

    await screen.findByText("checkout.identity.verification")

    const inputs = screen.getAllByRole("textbox")
    fireEvent.change(inputs[0], { target: { value: "654321" } })

    const verifyBtn = screen.getByRole("button", { name: "checkout.identity.verify" })
    expect(verifyBtn).not.toBeDisabled()
    
    verifyOtpMock.mockResolvedValueOnce({ data: { session: { user: { email: "buyer@example.com" } } }, error: null })
    fireEvent.click(verifyBtn)

    await waitFor(() => {
      expect(verifyOtpMock).toHaveBeenCalledWith({ email: "buyer@example.com", token: "654321", type: "email" })
    })
  })
})
