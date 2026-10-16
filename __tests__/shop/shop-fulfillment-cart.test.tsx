import { useRef, useState } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ShopFulfillmentHeader } from "@/app/shop/[siteSlug]/ShopFulfillmentHeader"
import { CartSidebar } from "@/app/shop/[siteSlug]/CartSidebar"
import { useShopFulfillmentPreference } from "@/app/commerce/use-shop-fulfillment-preference"
import { readShopFulfillmentPreference } from "@/app/commerce/shop-fulfillment-preference"
import type { CheckoutFulfillmentMethod } from "@/app/commerce/delivery-options"

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: () => "", locale: "en" }),
}))
jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({ formatPrice: (price: number) => `$${price}` }),
}))
jest.mock("@/app/components/ui/date-picker", () => ({ DatePicker: () => null }))
jest.mock("@/app/components/commerce/CheckoutIdentityPicker", () => ({ CheckoutIdentityPicker: () => null }))
jest.mock("@/app/components/commerce/CartItem", () => ({ CartItem: () => null }))
jest.mock("@/app/components/commerce/PromoCodeField", () => ({ PromoCodeField: () => null }))
jest.mock("@/app/components/commerce/CartCheckoutFields", () => ({
  CartCheckoutFields: ({ fulfillment, setFulfillment }: {
    fulfillment: CheckoutFulfillmentMethod
    setFulfillment: (value: CheckoutFulfillmentMethod) => void
  }) => (
    <div>
      <output data-testid="checkout-fulfillment">{fulfillment}</output>
      <button type="button" onClick={() => setFulfillment("pickup")}>Checkout pickup</button>
    </div>
  ),
}))

const options: CheckoutFulfillmentMethod[] = ["pickup", "ship", "dine_in"]
const site = { id: "site-1", settings: { shop: { default_delivery_options: options } } }
const cart = [{ id: "item-1", site_id: "site-1", kind: "product", name: "Widget", cartPrice: 10, cartQty: 1 }]
const stores = [{ id: "store-1", is_active: true }]
const noop = () => undefined

function ShopCartHarness() {
  const [fulfillment, setFulfillment] = useState<CheckoutFulfillmentMethod>("ship")
  const [open, setOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState("")
  const userChosePaymentRef = useRef(false)
  const preference = useShopFulfillmentPreference({ siteId: site.id, setFulfillment })

  return (
    <>
      <output data-testid="preference-loaded">{String(preference.isPreferenceLoaded)}</output>
      <ShopFulfillmentHeader
        allowedOptions={options}
        fulfillment={fulfillment}
        setFulfillment={preference.setFulfillmentByUser}
        orderTiming="now"
        setOrderTiming={noop}
        scheduledFor={null}
        setScheduledFor={noop}
        tone="hero"
      />
      <button onClick={() => setOpen(!open)}>Toggle cart</button>
      {open && (
        <CartSidebar
          cart={cart} subtotal={10} updateQty={noop} session={null}
          customerName="" setCustomerName={noop} customerEmail="" setCustomerEmail={noop}
          fulfillment={fulfillment} setFulfillment={setFulfillment}
          originLocationId="store-1" setOriginLocationId={noop} locations={stores}
          promotionCode="" setPromotionCode={noop} setPromoDiscount={noop}
          shippingAddress={{}} setShippingAddress={noop} ownerSiteId={null} setOwnerSiteId={noop}
          paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
          orderTiming="now" setOrderTiming={noop} scheduledFor={null} setScheduledFor={noop}
          orderNotes="" setOrderNotes={noop} isOpen locationAvailable
          handleCheckout={noop} checkoutLoading={false} closeCart={noop} site={site}
          selectedLocationId="store-1"
          userChoseFulfillmentRef={preference.userChoseFulfillmentRef}
          userChosePaymentRef={userChosePaymentRef}
          isFulfillmentPreferenceLoaded={preference.isPreferenceLoaded}
        />
      )}
    </>
  )
}

describe("Shop hero and cart fulfillment", () => {
  beforeEach(() => localStorage.clear())

  it.each([
    ["pickup", "Pickup"], ["ship", "Delivery"], ["dine_in", "Dine-in"],
  ])("keeps %s selected when checkout opens and reopens at a nearby store", async (method, label) => {
    render(<ShopCartHarness />)
    await waitFor(() => expect(screen.getByTestId("preference-loaded")).toHaveTextContent("true"))
    fireEvent.click(screen.getByRole("radio", { name: label }))
    fireEvent.click(screen.getByRole("button", { name: "Toggle cart" }))
    expect(screen.getByTestId("checkout-fulfillment")).toHaveTextContent(method)
    fireEvent.click(screen.getByRole("button", { name: "Toggle cart" }))
    fireEvent.click(screen.getByRole("button", { name: "Toggle cart" }))
    expect(screen.getByTestId("checkout-fulfillment")).toHaveTextContent(method)
    expect(readShopFulfillmentPreference(site.id)).toBe(method)
  })

  it("syncs a manual checkout change back to the hero and restores it after navigation", async () => {
    const shop = render(<ShopCartHarness />)
    await waitFor(() => expect(screen.getByTestId("preference-loaded")).toHaveTextContent("true"))
    fireEvent.click(screen.getByRole("radio", { name: "Dine-in" }))
    fireEvent.click(screen.getByRole("button", { name: "Toggle cart" }))
    fireEvent.click(screen.getByRole("button", { name: "Checkout pickup" }))
    expect(screen.getByRole("radio", { name: "Pickup" })).toHaveAttribute("aria-checked", "true")
    expect(readShopFulfillmentPreference(site.id)).toBe("pickup")
    shop.unmount()
    render(<ShopCartHarness />)
    await waitFor(() => expect(screen.getByRole("radio", { name: "Pickup" })).toHaveAttribute("aria-checked", "true"))
  })
})