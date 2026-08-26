import { render, screen } from "@testing-library/react"
import { format } from "date-fns"
import { enUS } from "date-fns/locale"
import { PosCartLines } from "@/app/pos/components/PosCartLines"
import type { PosCartItem } from "@/app/pos/components/CartPanel"

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({
    locale: "en",
    t: (key: string) =>
      ({
        "pos.cart.reservation": "Reservation",
        "pos.modifiers.title": "Extras",
      }[key] || key),
  }),
}))

jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({
    formatPrice: (amount: number, currency: string) =>
      `${currency} ${amount.toFixed(2)}`,
  }),
}))

jest.mock("@/app/lib/image-utils", () => ({
  resolveItemImage: () => "/test.jpg",
}))

function cartItem(overrides: Partial<PosCartItem> = {}): PosCartItem {
  return {
    id: "item-1",
    name: "Corte",
    cartQty: 1,
    cartPrice: 250,
    currency: "MXN",
    ...overrides,
  } as PosCartItem
}

describe("PosCartLines reservation appendix", () => {
  const reservationStart = "2026-08-26T21:00:00.000Z"
  const reservationLabel = format(new Date(reservationStart), "MMM d, h:mm a", {
    locale: enUS,
  })

  it("renders the reservation in a footer appendix, not under the item name", () => {
    render(
      <PosCartLines
        cart={[cartItem({ reservationStart })]}
        selectedCartItemId={null}
        setSelectedCartItemId={() => {}}
        updateQty={() => {}}
      />,
    )

    const heading = screen.getByRole("heading", { name: "Corte" })
    expect(heading.nextElementSibling).not.toHaveTextContent(reservationLabel)
    expect(screen.getByText("Reservation")).toBeInTheDocument()
    expect(screen.getByText(reservationLabel)).toBeInTheDocument()
  })

  it("keeps extras and reservation together in the card footer", () => {
    render(
      <PosCartLines
        cart={[
          cartItem({
            reservationStart,
            modifiers: [
              {
                groupId: "g1",
                catalogItemId: "mod-1",
                name: "Beard trim",
                cartQty: 1,
                cartPrice: 50,
              },
            ],
          }),
        ]}
        selectedCartItemId={null}
        setSelectedCartItemId={() => {}}
        updateQty={() => {}}
      />,
    )

    expect(screen.getByText("Reservation")).toBeInTheDocument()
    expect(screen.getByText("Extras")).toBeInTheDocument()
    expect(screen.getByText("Beard trim")).toBeInTheDocument()
  })

  it("omits the reservation appendix when the line has no slot", () => {
    render(
      <PosCartLines
        cart={[cartItem()]}
        selectedCartItemId={null}
        setSelectedCartItemId={() => {}}
        updateQty={() => {}}
      />,
    )

    expect(screen.queryByText("Reservation")).not.toBeInTheDocument()
  })
})
