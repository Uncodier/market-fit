import React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { format } from "date-fns"
import { LocalizationProvider, useLocalization, type SupportedLocale } from "@/app/context/LocalizationContext"
import { getDateFnsLocale } from "@/app/lib/date-fns-locale"
import { COMMERCE_LOCALES } from "@/app/components/commerce/commerce-locales"
import { LocaleSelector } from "@/app/components/commerce/LocaleSelector"
import { CartButton } from "@/app/components/commerce/CartButton"
import { CartItem } from "@/app/components/commerce/CartItem"
import { MobileShellSearchExpanded } from "@/app/components/commerce/MobileShellSearch"
import { PdpHeroGallery } from "@/app/components/commerce/pdp/PdpHeroGallery"
import { PdpProductGallery } from "@/app/components/commerce/pdp/PdpProductGallery"
import { Pagination } from "@/app/components/ui/pagination"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { OrderSummary } from "@/app/cart/checkout/OrderSummary"
import { CheckoutEmptyState, CheckoutLoadingState } from "@/app/cart/checkout/CheckoutStates"

jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({ formatPrice: (amount: number, currency: string) => `${currency} ${amount}` }),
}))
jest.mock("@/app/promotions/actions", () => ({ previewPromotionForCart: jest.fn() }))

const reservationStart = new Date(2026, 8, 15, 15, 30).toISOString()
const item = {
  id: "item", site_id: "seller", name: "Reservation", currency: "USD",
  cartQty: 2, cartPrice: 1234.5, reservationStart,
  modifiers: [{ groupId: "extras", catalogItemId: "extra", name: "Extra", cartPrice: 5, cartQty: 2 }],
}

function LocaleButtons() {
  const { setLocale } = useLocalization()
  return <>{COMMERCE_LOCALES.map(({ value }) => (
    <button key={value} onClick={() => setLocale(value)}>{value}</button>
  ))}</>
}

function LocalizedSort() {
  const { t } = useLocalization()
  return <SortDropdown sortBy="newest" setSortBy={jest.fn()} title={t("marketplace.sort.by")}
    options={[{ value: "newest", label: t("marketplace.sort.newest") }]} />
}

beforeEach(() => {
  localStorage.clear()
  document.cookie = "makinari-locale=; Max-Age=0; path=/"
})

test("updates shared pagination, sort, cart and mobile search labels immediately", () => {
  const onPageChange = jest.fn()
  const onOpenChange = jest.fn()
  render(<LocalizationProvider preferredLocale="en">
    <LocaleButtons />
    <Pagination currentPage={5} totalPages={20} onPageChange={onPageChange} />
    <LocalizedSort />
    <CartButton cartCount={2} href="/cart/checkout" />
    <MobileShellSearchExpanded value="" onChange={jest.fn()} placeholder="Search" open onOpenChange={onOpenChange} />
  </LocalizationProvider>)

  expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled()
  expect(screen.getByTitle("Sort by")).toHaveTextContent("Newest")
  expect(screen.getByRole("link", { name: "Open cart, 2 items" })).toHaveAttribute("href", "/cart/checkout")
  fireEvent.click(screen.getByRole("button", { name: "es" }))
  expect(screen.queryByRole("button", { name: "Previous page" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Ir a la página anterior" })).toBeEnabled()
  expect(screen.getByText("Más páginas")).toBeInTheDocument()
  expect(screen.getByTitle("Ordenar por")).toHaveTextContent("Más recientes")
  fireEvent.click(screen.getByRole("button", { name: "Ir a la página siguiente" }))
  expect(onPageChange).toHaveBeenCalledWith(6)
  fireEvent.click(screen.getByRole("button", { name: "Cerrar búsqueda" }))
  expect(onOpenChange).toHaveBeenCalledWith(false)
  expect(document.documentElement.lang).toBe("es")
})

test("keeps SortDropdown's unrelated default title contract", () => {
  render(<SortDropdown sortBy="newest" setSortBy={jest.fn()} />)
  expect(screen.getByTitle("Sort by")).toHaveTextContent("Newest")
})

test("provides all supported native language choices from the shared locale list", () => {
  render(<LocalizationProvider preferredLocale="en"><LocaleSelector /></LocalizationProvider>)
  fireEvent.keyDown(screen.getByRole("button", { name: "Change language" }), { key: "ArrowDown" })
  for (const { label } of COMMERCE_LOCALES) expect(screen.getByRole("menuitem", { name: label })).toBeInTheDocument()
  fireEvent.click(screen.getByRole("menuitem", { name: "日本語" }))
  expect(document.documentElement.lang).toBe("ja")
  expect(screen.queryByRole("button", { name: "Change language" })).not.toBeInTheDocument()
})

test("localizes empty and loading checkout without changing the return link", () => {
  render(<LocalizationProvider preferredLocale="en">
    <LocaleButtons />
    <CheckoutLoadingState />
    <CheckoutEmptyState returnTo="/marketplace?region=JP" />
  </LocalizationProvider>)
  expect(screen.getByRole("status")).toHaveTextContent("Loading checkout...")
  expect(screen.getByRole("heading", { name: "Checkout empty" })).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "es" }))
  expect(screen.getByRole("status")).not.toHaveTextContent("Loading checkout...")
  expect(screen.getByRole("heading", { name: "No hay artículos para comprar" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Seguir comprando" })).toHaveAttribute("href", "/marketplace?region=JP")
})

test("localizes gallery fallback, image descriptions and navigation", () => {
  render(<LocalizationProvider preferredLocale="en">
    <LocaleButtons />
    <PdpProductGallery itemName="Product" mainSrc={null} entries={[]} selectedIndex={0} onThumbClick={jest.fn()} />
    <PdpHeroGallery itemName="Product" entries={[{ url: "/one.png" }, { url: "/two.png" }]} />
  </LocalizationProvider>)
  expect(screen.getByText("No image")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "es" }))
  expect(screen.getByText("Sin imagen")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Imagen anterior" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Imagen siguiente" })).toBeEnabled()
  expect(screen.getAllByRole("button", { name: "Ir a la diapositiva 2" })).toHaveLength(2)
  expect(screen.getByRole("img", { name: "Product - Imagen 2" })).toBeInTheDocument()
})

test.each(COMMERCE_LOCALES.map(({ value }) => value))(
  "formats reservation dates and checkout money in %s without converting currency or amounts", (locale: SupportedLocale) => {
    const updateQty = jest.fn()
    render(<LocalizationProvider preferredLocale="en">
      <LocaleButtons />
      <section aria-label="cart"><CartItem item={item} updateQty={updateQty} /></section>
      <section aria-label="summary"><OrderSummary items={[item]} subtotal={2489} shippingCost={7}
        checkoutLoading={false} fulfillment="ship" paymentMethod="bank_transfer"
        promotionCode="" setPromotionCode={jest.fn()} promoDiscount={9} setPromoDiscount={jest.fn()} /></section>
    </LocalizationProvider>)
    fireEvent.click(screen.getByRole("button", { name: locale }))
    const dateLocale = getDateFnsLocale(locale)
    const date = format(new Date(reservationStart), "PP", { locale: dateLocale })
    const time = format(new Date(reservationStart), "p", { locale: dateLocale })
    for (const scope of ["cart", "summary"]) {
      const section = within(screen.getByRole("region", { name: scope }))
      expect(section.getByText(date)).toBeInTheDocument()
      expect(section.getByText(time)).toBeInTheDocument()
    }
    const money = (amount: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(amount)
    const summary = within(screen.getByRole("region", { name: "summary" }))
    expect(summary.getAllByText(money(2489), { exact: true, normalizer: text => text })).toHaveLength(2)
    expect(summary.getByText(money(2487), { exact: true, normalizer: text => text })).toBeInTheDocument()
    expect(summary.getByText(`-${money(9)}`, { exact: true, normalizer: text => text })).toBeInTheDocument()
    expect(summary.getByText(money(7), { exact: true, normalizer: text => text })).toBeInTheDocument()
    expect(summary.getAllByText(money(2489), { normalizer: text => text })[0]).not.toHaveTextContent("EUR")
  }
)