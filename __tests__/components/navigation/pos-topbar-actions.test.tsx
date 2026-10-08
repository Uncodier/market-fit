import { act, fireEvent, render, screen } from "@testing-library/react"
import { PosTopBarActions } from "@/app/components/navigation/PosTopBarActions"

let mockSite: { id: string } | null = { id: "site-one" }

jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: mockSite }),
}))
jest.mock("@/app/components/auth/auth-provider", () => ({
  useAuthContext: () => ({ user: null }),
}))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: () => "Send Order" }),
}))
jest.mock("@/app/pos/components/PosSellerSelector", () => ({
  PosSellerSelector: () => null,
}))

const originalResizeObserver = global.ResizeObserver

beforeAll(() => {
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }))
})

afterAll(() => {
  global.ResizeObserver = originalResizeObserver
})

beforeEach(() => {
  mockSite = { id: "site-one" }
})

function updateCart(detail: { qty: number; deltaQty?: number }) {
  act(() => {
    window.dispatchEvent(new CustomEvent("pos:cart-updated", { detail }))
  })
}

describe("POS top bar send action", () => {
  it("keeps the icon action visible on mobile and only shows its text from sm", () => {
    render(<PosTopBarActions />)

    const button = screen.getByRole("button", { name: "Send Order" })
    const label = screen.getByText("Send Order")
    const container = button.closest(".overflow-visible")

    expect(button).toHaveAttribute("aria-label", "Send Order")
    expect(button).toHaveClass("!flex", "!w-9", "sm:!w-auto")
    expect(button.querySelector("svg")).toBeInTheDocument()
    expect(label).toHaveClass("hidden", "sm:inline")
    expect(container).toHaveClass("relative", "shrink-0", "overflow-visible")
    expect(container).not.toHaveClass("hidden")
    expect(container).not.toHaveClass("sm:block")
  })

  it("keeps the pending changes chip in the visible send container", () => {
    render(<PosTopBarActions />)
    updateCart({ qty: 8, deltaQty: 3 })

    const button = screen.getByRole("button", { name: "Send Order" })
    const chip = screen.getByText("3")

    expect(chip).toBeVisible()
    expect(chip.parentElement).toBe(button.closest(".overflow-visible"))
    expect(chip).toHaveClass("absolute", "pointer-events-none")

    updateCart({ qty: 8, deltaQty: 0 })
    expect(screen.queryByText("3")).not.toBeInTheDocument()
    expect(button).toBeVisible()
  })

  it("preserves the cart quantity fallback and caps the chip at 99+", () => {
    render(<PosTopBarActions />)
    updateCart({ qty: 120 })

    expect(screen.getByText("99+")).toBeVisible()
  })

  it("dispatches the existing send order event", () => {
    render(<PosTopBarActions />)
    const listener = jest.fn()
    window.addEventListener("pos:send-order", listener)

    try {
      fireEvent.click(screen.getByRole("button", { name: "Send Order" }))
      expect(listener).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener("pos:send-order", listener)
    }
  })

  it("does not render the action without a selected site", () => {
    mockSite = null
    const { container } = render(<PosTopBarActions />)

    expect(container).toBeEmptyDOMElement()
  })
})