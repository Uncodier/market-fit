import React from "react"
import { render, screen } from "@testing-library/react"
import { CartButton } from "@/app/components/commerce/CartButton"

jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({
    formatPrice: (amount: number, currency: string) => `${currency} ${amount}`,
  }),
}))

describe("CartButton", () => {
  it.each(["ghost", "shell"] as const)(
    "renders %s href mode as one link without a nested button",
    (variant) => {
      const ref = React.createRef<HTMLAnchorElement | HTMLButtonElement>()

      render(
        <CartButton
          ref={ref}
          href="/shop/example?cart=1"
          cartCount={2}
          variant={variant}
        />,
      )

      const link = screen.getByRole("link", { name: "Open cart, 2 items" })
      expect(link).toHaveAttribute("href", "/shop/example?cart=1")
      expect(link.querySelector("button")).toBeNull()
      expect(screen.queryByRole("button")).not.toBeInTheDocument()
      expect(ref.current).toBe(link)
    },
  )

  it("keeps button mode as a labeled button", () => {
    const ref = React.createRef<HTMLAnchorElement | HTMLButtonElement>()

    render(<CartButton ref={ref} cartCount={1} variant="ghost" />)

    const button = screen.getByRole("button", { name: "Open cart, 1 item" })
    expect(ref.current).toBe(button)
  })
})
