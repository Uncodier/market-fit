import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import en from "@/app/context/locales/screens/commerce-pages-en.json"
import es from "@/app/context/locales/screens/commerce-pages-es.json"
import CreditsCheckoutPage from "@/app/checkout/page"
import MarketplaceBookingPage from "@/app/marketplace/[itemId]/book/page"
import ShopBookingClient from "@/app/shop/[siteSlug]/[itemId]/book/ShopBookingClient"
import QuotePdfPage from "@/app/quote-pdf/[id]/page"
import { creditPackages } from "@/app/checkout/credit-packages"
import { localizeCheckoutError } from "@/app/checkout/checkout-feedback"

let mockLocale: "en" | "es" = "es"
let mockUser: { email?: string } | null = { email: "buyer@example.test" }
let mockSite: { id: string; name: string } | null = { id: "site-fixture", name: "Example site" }
let mockItem: { id: string; name: string; site_id: string } | null = null
const mockPush = jest.fn()
const mockAddToCart = jest.fn()
const mockToastError = jest.fn()
const mockToastSuccess = jest.fn()
const mockGetQuotation = jest.fn()
const mockEnsureToken = jest.fn()
const mockTranslate = (key: string, params?: Record<string, string | number>) => {
  const messages: Record<string, string> = mockLocale === "es" ? es : en
  return Object.entries(params || {}).reduce((value, [name, replacement]) => value.replaceAll(`{{${name}}}`, String(replacement)), messages[key] || key)
}

// Fulfilled route parameters stand in for Next.js's Promise unwrapping.
jest.mock("react", () => ({ ...jest.requireActual("react"), use: (value: unknown) => value }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: mockTranslate }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: mockSite, sites: [{ id: "site-fixture" }], isLoading: false }) }))
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: mockUser }) }))
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }), useSearchParams: () => ({ get: () => "52" }) }))
jest.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => mockToastError(...args), success: (...args: unknown[]) => mockToastSuccess(...args) } }))
jest.mock("@/app/catalog/actions", () => ({ getCatalogItem: jest.fn() }))
jest.mock("@/app/shop/[siteSlug]/actions", () => ({ getShopSite: jest.fn() }))
jest.mock("swr", () => ({ __esModule: true, default: (key: string[]) => ({ data: key[0] === "shop-site" ? mockSite : { data: mockItem }, isLoading: false }) }))
jest.mock("@/app/components/commerce/pdp/usePdpCart", () => ({ usePdpCart: () => ({ addToCartStorage: mockAddToCart }) }))
jest.mock("@/app/components/commerce/booking/BookingExperience", () => ({
  BookingExperience: ({ onCartAdd }: { onCartAdd: (start: string, end: string, available: number) => void }) => <button onClick={() => onCartAdd("start-fixture", "end-fixture", 2)}>Add fixture</button>,
}))
jest.mock("@/app/shop/[siteSlug]/ShopSlugNotFound", () => ({ ShopSlugNotFound: () => null }))
jest.mock("@/app/shop/[siteSlug]/[itemId]/book/loading", () => ({ __esModule: true, default: () => null }))
jest.mock("@/app/quotations/actions", () => ({ getQuotation: (...args: unknown[]) => mockGetQuotation(...args) }))
jest.mock("@/app/quotations/public-actions", () => ({ ensureQuotationPublicAccessToken: (...args: unknown[]) => mockEnsureToken(...args) }))
jest.mock("@/app/documents/components/PublicDocumentShopNav", () => ({ PublicDocumentShopNav: () => null }))
jest.mock("@/app/documents/components/PublicDocumentViewSkeleton", () => ({ PublicDocumentViewSkeleton: () => null }))
jest.mock("@/app/quotations/components/PrintableQuotation", () => ({ PrintableQuotation: ({ locale, buyerLink }: { locale: string; buyerLink: string }) => <div data-testid="printable" data-locale={locale} data-buyer-link={buyerLink} /> }))
jest.mock("@/app/lib/i18n/document-t", () => ({
  documentT: (locale: string, key: string, params: Record<string, string | number>) => {
    const messages: Record<string, string> = locale === "es" ? es : en
    return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{{${name}}}`, String(replacement)), messages[key] || key)
  },
}))

const routePromise = <T,>(value: T) => value as unknown as Promise<T>

beforeEach(() => {
  jest.clearAllMocks()
  mockLocale = "es"
  mockUser = { email: "buyer@example.test" }
  mockSite = { id: "site-fixture", name: "Example site" }
  mockItem = null
  mockGetQuotation.mockResolvedValue({ error: "Not found" })
  mockEnsureToken.mockResolvedValue({ token: "fixture-token" })
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  window.matchMedia = jest.fn().mockReturnValue({ matches: true })
  jest.spyOn(console, "log").mockImplementation(() => {})
  jest.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => jest.restoreAllMocks())

it("keeps English/Spanish keys and interpolation parameters aligned", () => {
  expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort())
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    expect(es[key]).toBeTruthy()
    expect(es[key].match(/\{\{.*?\}\}/g) || []).toEqual(en[key].match(/\{\{.*?\}\}/g) || [])
  }
})

it("preserves the exact display package values", () => {
  expect(creditPackages.map(({ credits, price, pricePerCredit }) => ({ credits, price, pricePerCredit }))).toEqual([
    { credits: 20, price: 20, pricePerCredit: 1 },
    { credits: 52, price: 49.25, pricePerCredit: 0.95 },
    { credits: 515, price: 500, pricePerCredit: 0.97 },
  ])
})

it("renders localized package labels without changing price displays or navigation", async () => {
  const view = render(<CreditsCheckoutPage />)
  await screen.findByRole("button", { name: "Comprar 52 créditos" })
  expect(screen.getAllByText("1.5% de descuento")).toHaveLength(2)
  expect(screen.getAllByText("$49.25").length).toBe(3)
  fireEvent.click(screen.getByText("20 créditos"))
  expect(mockPush).toHaveBeenCalledWith("/checkout?credits=20")
  mockLocale = "en"
  view.rerender(<CreditsCheckoutPage />)
  expect(screen.getByRole("button", { name: "Purchase 52 Credits" })).toBeInTheDocument()
})

it("keeps checkout endpoint, amounts, identity and return URL payloads unchanged", async () => {
  render(<CreditsCheckoutPage />)
  fireEvent.click(await screen.findByRole("button", { name: "Comprar 52 créditos" }))
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
  const [url, request] = jest.mocked(global.fetch).mock.calls[0]
  expect(url).toBe("/api/stripe/checkout/credits")
  expect(request?.method).toBe("POST")
  expect(JSON.parse(String(request?.body))).toEqual({
    credits: 52, amount: 49.25, siteId: "site-fixture", userEmail: "buyer@example.test",
    successUrl: `${window.location.origin}/billing/success?credits=52`,
    cancelUrl: `${window.location.origin}/billing?tab=billing_info`,
  })
  await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(es["commercePages.checkout.errors.missingUrl"]))
})

it.each([
  [null, es["commercePages.checkout.errors.loginRequired"]],
  [{}, es["commercePages.checkout.errors.emailRequired"]],
])("localizes client validation without starting a checkout", async (user, message) => {
  mockUser = user
  render(<CreditsCheckoutPage />)
  fireEvent.click(await screen.findByRole("button", { name: "Comprar 52 créditos" }))
  expect(mockToastError).toHaveBeenCalledWith(message)
  expect(global.fetch).not.toHaveBeenCalled()
})

it("localizes the no-site-selected state", async () => {
  mockSite = null
  render(<CreditsCheckoutPage />)
  expect(await screen.findByText("Ningún sitio seleccionado")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Ir al panel de control" }))
  expect(mockPush).toHaveBeenCalledWith("/dashboard")
})

it.each([
  ["Stripe failed", "configuration"], ["Failed to fetch", "network"],
  ["Invalid credit package", "invalidPackage"], ["Forbidden", "forbidden"],
  ["Provider failure with internal details", "start"],
])("localizes checkout errors safely: %s", (message, suffix) => {
  expect(localizeCheckoutError(new Error(message), mockTranslate)).toBe(mockTranslate(`commercePages.checkout.errors.${suffix}`))
})

it("localizes marketplace missing items", () => {
  render(<MarketplaceBookingPage params={routePromise({ itemId: "item-fixture" })} searchParams={routePromise({})} />)
  expect(screen.getByText("Artículo no encontrado")).toBeInTheDocument()
})

it.each(["marketplace", "shop"])("localizes %s booking title/toast and preserves cart arguments", (mode) => {
  mockItem = { id: "item-fixture", name: "Fixture item", site_id: "site-fixture" }
  const modifiers = encodeURIComponent(JSON.stringify([{ id: "modifier-fixture" }]))
  render(mode === "shop"
    ? <ShopBookingClient params={routePromise({ siteSlug: "fixture-shop", itemId: "item-fixture" })} searchParams={routePromise({ modifiers })} />
    : <MarketplaceBookingPage params={routePromise({ itemId: "item-fixture" })} searchParams={routePromise({ modifiers })} />)
  expect(document.title).toBe(`Reservar Fixture item | ${mode === "shop" ? "Example site" : "Marketplace"}`)
  fireEvent.click(screen.getByRole("button", { name: "Add fixture" }))
  expect(mockAddToCart).toHaveBeenCalledWith(mockItem, 1, "start-fixture", "end-fixture", [{ id: "modifier-fixture" }], 2)
  expect(mockToastSuccess).toHaveBeenCalledWith("Fixture item añadido al carrito")
  expect(mockPush).toHaveBeenCalledWith(mode === "shop" ? "/shop/fixture-shop?cart=1" : "/marketplace?cart=1")
})

it("localizes quote not-found without requesting a public token", async () => {
  render(<QuotePdfPage params={routePromise({ id: "quote-fixture" })} />)
  expect(await screen.findByText("Cotización no encontrada")).toBeInTheDocument()
  expect(mockGetQuotation).toHaveBeenCalledWith("quote-fixture")
  expect(mockEnsureToken).not.toHaveBeenCalled()
})

it("keeps quote titles/print locale tied to the site, not the viewing account", async () => {
  mockLocale = "en"
  mockGetQuotation.mockResolvedValue({ data: { id: "quote-fixture", site: { id: "site-fixture", settings: { default_locale: "es" } } } })
  render(<QuotePdfPage params={routePromise({ id: "quote-fixture" })} />)
  await waitFor(() => expect(document.title).toBe("Cotización - quote-fi"))
  expect(screen.getByTestId("printable")).toHaveAttribute("data-locale", "es")
  expect(mockEnsureToken).toHaveBeenCalledWith("quote-fixture")
  await waitFor(() => expect(screen.getByTestId("printable").getAttribute("data-buyer-link")).toContain("fixture-token"))
})