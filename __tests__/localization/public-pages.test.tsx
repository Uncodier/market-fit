import React from "react"
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import en from "@/app/context/locales/screens/public-en.json"
import es from "@/app/context/locales/screens/public-es.json"
import DemoPage from "@/app/demo/page"
import InvoicePage from "@/app/invoice-pdf/[id]/page"
import SocialPage from "@/app/settings/social_network/page"
import { formatInvoiceDate, formatInvoicePaymentMethod, useInvoiceLocalization } from "@/app/invoice-pdf/[id]/invoice-localization"
import { oauthErrorMessage } from "@/app/settings/social_network/oauth-localization"
import { getSaleById, getSaleOrderBySaleId } from "@/app/sales/actions"
import type { Sale } from "@/app/types"

type Messages = Record<string, string>
let mockLocale = "es"
let mockSiteLocale: string | undefined
let mockParams = new URLSearchParams()
const mockPush = jest.fn()
const mockRouter = { push: mockPush }
const mockBillingLimit = jest.fn()
const mockBillingError = jest.fn(() => false)
const mockTranslate = (locale: string, key: string, params?: Record<string, string | number>) => {
  const messages: Messages = locale === "es" ? es : en
  return Object.entries(params || {}).reduce((text, [name, value]) => text.split(`{{${name}}}`).join(String(value)), messages[key] || key)
}
const mockT = (key: string, params?: Record<string, string | number>) => mockTranslate(mockLocale, key, params)

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ locale: mockLocale, t: mockT }),
}))
jest.mock("@/app/lib/i18n/document-t", () => ({
  resolveDocumentLocale: (value: string) => value === "es" ? "es" : "en",
  documentT: (locale: string, key: string, params?: Record<string, string | number>) => mockTranslate(locale === "es" ? "es" : "en", key, params),
}))
jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: { id: "site-1", name: "Company Data", url: "https://company.example", settings: { default_locale: mockSiteLocale } } }),
}))
jest.mock("next/navigation", () => ({ useSearchParams: () => mockParams, useRouter: () => mockRouter }))
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement("img", { src: props.src, alt: props.alt }),
}))
jest.mock("@/lib/demo-data", () => ({ availableDemos: [{ id: "demo-data", name: "Demo Data Name", description: "Fixture description", url: "https://demo.example" }] }))
jest.mock("@/app/sales/actions", () => ({ getSaleById: jest.fn(), getSaleOrderBySaleId: jest.fn() }))
jest.mock("@/app/segments/actions", () => ({ getSegments: jest.fn(async () => ({ segments: [] })) }))
jest.mock("@/app/campaigns/actions/campaigns/read", () => ({ getCampaigns: jest.fn(async () => ({ data: [] })) }))
jest.mock("@/app/components/dashboard/campaign-revenue-donut", () => ({ formatCurrency: (value: number) => `$${value.toFixed(2)}` }))
jest.mock("@/lib/billing-limits", () => ({ getSocialAccountLimit: () => 5, countSocialAccounts: () => 0, canConnectSocialAccount: () => true }))
jest.mock("@/lib/billing/startup-trial", () => ({ effectiveBillingPlan: () => "engine" }))
jest.mock("@/app/context/BillingLimitContext", () => ({ useBillingLimit: () => ({ showBillingLimit: mockBillingLimit, showBillingLimitFromError: mockBillingError }) }))

const sale = {
  id: "sale-1", title: "Customer title", productName: "Customer product", amount: 123.45,
  amount_due: 23.45, currency: "USD", status: "pending", source: "retail", leadName: "Customer Name",
  segmentId: null, campaignId: null, saleDate: "2026-01-12T12:00:00Z", paymentMethod: "credit_card",
  notes: "Customer notes", tags: ["Customer tag"], createdAt: "2026-01-12T12:00:00Z", updatedAt: "2026-01-12T12:00:00Z",
} as Sale
const saleOrder = {
  id: "order-1", orderNumber: "ORDER-DATA", subtotal: 100, taxTotal: 10, discountTotal: 5, total: 105,
  createdAt: "2026-01-12T12:00:00Z", items: [{ id: "item-1", name: "Customer item", quantity: 2, unitPrice: 50, subtotal: 100 }],
  saleId: sale.id, notes: "Order data notes", status: "completed", siteId: "site-1",
  promotionId: undefined, priceListId: undefined, updatedAt: "2026-01-12T12:00:00Z",
}

beforeEach(() => {
  jest.clearAllMocks()
  mockLocale = "es"
  mockSiteLocale = undefined
  mockParams = new URLSearchParams()
  window.matchMedia = jest.fn(() => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() })) as unknown as typeof window.matchMedia
  document.cookie = "market_fit_demo_site_id=; path=/; max-age=0"
  jest.mocked(getSaleById).mockResolvedValue({ sale })
  jest.mocked(getSaleOrderBySaleId).mockResolvedValue({ saleOrder })
  global.fetch = jest.fn(async () => ({ json: async () => ({ success: true, data: { availablePages: [{ id: "page-1", name: "Page Data", username: "@data" }] } }) })) as jest.Mock
})
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers() })

test("English/Spanish overlays have matching keys and interpolation parameters", () => {
  expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort())
  for (const key of Object.keys(en) as Array<keyof typeof en>) {
    expect(es[key].match(/\{\{[^}]+\}\}/g)?.sort()).toEqual(en[key].match(/\{\{[^}]+\}\}/g)?.sort())
  }
})

test("invoice locale uses the site document locale before UI locale and keeps t stable", () => {
  const { result, rerender } = renderHook(({ siteLocale }: { siteLocale: string | undefined }) => useInvoiceLocalization(siteLocale), { initialProps: { siteLocale: "en" as string | undefined } })
  expect(result.current.locale).toBe("en")
  expect(result.current.t("public.invoice.heading")).toBe("INVOICE")
  const firstT = result.current.t
  rerender({ siteLocale: "en" })
  expect(result.current.t).toBe(firstT)
  rerender({ siteLocale: undefined })
  expect(result.current.locale).toBe("es")
  expect(result.current.t("public.invoice.heading")).toBe("FACTURA")
})

test("invoice date/payment labels localize without changing provider or unknown values", () => {
  const t = (key: string) => mockTranslate("es", key)
  expect(formatInvoiceDate("2026-01-12T12:00:00Z", "es")).toBe("ene 12, 2026")
  expect(formatInvoiceDate("invalid date", "es")).toBe("invalid date")
  expect(formatInvoicePaymentMethod("credit_card", t)).toBe("Tarjeta de crédito")
  expect(formatInvoicePaymentMethod("paypal", t)).toBe("PayPal")
  expect(formatInvoicePaymentMethod("CUSTOM_METHOD", t)).toBe("CUSTOM METHOD")
})

test("printable invoice keeps totals, record data and canonical status/source unchanged", async () => {
  jest.spyOn(React, "use").mockReturnValue({ id: "sale-1" })
  const view = render(<InvoicePage params={Promise.resolve({ id: "sale-1" })} />)
  await screen.findByText("FACTURA")
  expect(getSaleById).toHaveBeenCalledWith("site-1", "sale-1")
  expect(getSaleOrderBySaleId).toHaveBeenCalledWith("site-1", "sale-1")
  for (const value of ["Customer Name", "Customer title", "Customer product", "Customer notes", "Customer tag", "Customer item", "pending", "retail", "$105.00", "$100.00", "$10.00", "-$5.00"]) {
    expect(screen.getAllByText(value).length).toBeGreaterThan(0)
  }
  expect(screen.getByText("FACTURA").closest("[lang]")).toHaveAttribute("lang", "es")
  expect(document.title).toBe("Factura - Customer title")
  mockSiteLocale = "en"
  view.rerender(<InvoicePage params={Promise.resolve({ id: "sale-1" })} />)
  await screen.findByText("INVOICE")
  expect(document.title).toBe("Invoice - Customer title")
})

test("demo labels localize while fixture names/descriptions remain data", async () => {
  document.cookie = "market_fit_demo_site_id=demo-data; path=/"
  render(<DemoPage />)
  expect(screen.getByText("Cuentas de demostración")).toBeInTheDocument()
  await screen.findByText("Actual")
  expect(screen.getByText("Demo Data Name")).toBeInTheDocument()
  expect(screen.getByText("Fixture description")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Seleccionada" })).toBeInTheDocument()
  expect(screen.getByAltText("Logotipo de Market Fit")).toBeInTheDocument()
  expect(global.fetch).not.toHaveBeenCalled()
})

test("OAuth diagnostics translate instructions but retain literal technical values in display and copy", async () => {
  mockParams = new URLSearchParams({ error: "Missing code or state parameter", network: "facebook", our_redirect_uri: "https://callback.example/api/social/callback/facebook" })
  const writeText = jest.fn(async () => {})
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
  jest.spyOn(console, "log").mockImplementation(() => {})
  render(<SocialPage />)
  await screen.findByText(/Falló el callback de OAuth/)
  const support = screen.getByText(/^Asunto:/)
  expect(support).toHaveTextContent("https://callback.example/api/social/callback/facebook")
  for (const value of ["Missing code or state parameter", "?session=", "?error=", "https://www.outstand.so/app/api/socials/facebook/callback", "Valid OAuth Redirect URIs", "App Domains"]) {
    expect(support).toHaveTextContent(value)
  }
  expect(screen.getByText("NEXT_PUBLIC_FORCE_PRODUCTION_OAUTH_REDIRECT=true")).toBeInTheDocument()
  expect(screen.getByText(/Copia y envía a Outstand/)).toHaveTextContent("contact@outstand.so")
  fireEvent.click(screen.getByRole("button", { name: "Copiar" }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(support.textContent))
  expect(global.fetch).not.toHaveBeenCalled()
})

test("OAuth language changes update messages without refetching pending accounts", async () => {
  mockParams = new URLSearchParams({ session: "session-value", network: "facebook" })
  jest.spyOn(console, "log").mockImplementation(() => {})
  const view = render(<SocialPage />)
  await screen.findByText("Selecciona las páginas de facebook que quieres conectar:")
  expect(global.fetch).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("checkbox", { name: "Seleccionar Page Data" })).toBeChecked()
  mockLocale = "en"
  view.rerender(<SocialPage />)
  expect(screen.getByText("Select the facebook pages you want to connect:")).toBeInTheDocument()
  expect(global.fetch).toHaveBeenCalledTimes(1)
  expect(mockPush).not.toHaveBeenCalled()
})

test("OAuth finalization keeps selected IDs, site ID, network and endpoint intact", async () => {
  jest.useFakeTimers()
  mockParams = new URLSearchParams({ session: "token/value", network: "facebook" })
  jest.spyOn(console, "log").mockImplementation(() => {})
  render(<SocialPage />)
  await screen.findByRole("button", { name: "Conectar 1 página(s)" })
  fireEvent.click(screen.getByRole("button", { name: "Conectar 1 página(s)" }))
  await act(async () => {})
  expect(global.fetch).toHaveBeenLastCalledWith("/api/social/accounts/pending/token%2Fvalue/finalize", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountIds: ["page-1"], selectedPageIds: ["page-1"], siteId: "site-1", network: "facebook" }),
  })
  expect(screen.getByText("¡Se conectaron 1 página(s) correctamente!")).toBeInTheDocument()
})

test("known OAuth errors translate while unknown provider diagnostics are preserved", () => {
  expect(oauthErrorMessage("Unauthorized", "fallback")).toEqual({ key: "public.oauth.unauthorized" })
  expect(oauthErrorMessage("custom-provider-error", "fallback")).toEqual({ raw: "custom-provider-error" })
  expect(oauthErrorMessage("", "fallback")).toEqual({ key: "fallback" })
})