import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { PublicDocumentPaymentAction } from "@/app/documents/components/PublicDocumentPaymentAction"

describe("public document payment action", () => {
  const props = {
    title: "Payment Required",
    description: "Complete payment to process this document.",
    buttonLabel: "Pay Now",
    processing: false,
    onCheckout: jest.fn(),
  }

  beforeEach(() => jest.clearAllMocks())

  it("renders a rectangular checkout action and calls the document handler", () => {
    render(<PublicDocumentPaymentAction {...props} />)
    expect(screen.getByRole("heading", { name: props.title })).toBeInTheDocument()
    expect(screen.getByText(props.description)).toBeInTheDocument()
    const button = screen.getByRole("button", { name: "Pay Now" })
    expect(button).toHaveClass("rounded-xl")
    expect(button).not.toHaveClass("rounded-full")
    fireEvent.click(button)
    expect(props.onCheckout).toHaveBeenCalledTimes(1)
  })

  it("blocks checkout while processing and exposes the busy state", () => {
    render(<PublicDocumentPaymentAction {...props} processing />)
    const button = screen.getByRole("button", { name: "Pay Now" })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("aria-busy", "true")
    fireEvent.click(button)
    expect(props.onCheckout).not.toHaveBeenCalled()
  })
})