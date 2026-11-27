import { expect } from "@jest/globals"
import "@testing-library/jest-dom/jest-globals"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { BuyerIdentityScan, isSignedBuyerCode } from "@/app/shop/[siteSlug]/self-service/BuyerIdentityScan"
import { SelfServiceConfirmation } from "@/app/shop/[siteSlug]/self-service/SelfServiceConfirmation"
import { SelfServiceProductDetail } from "@/app/shop/[siteSlug]/self-service/SelfServiceProductDetail"
import { SelfServiceHero } from "@/app/shop/[siteSlug]/self-service/SelfServiceHero"
import { SelfServiceCart } from "@/app/shop/[siteSlug]/self-service/SelfServiceCart"
import { useSelfService } from "@/app/shop/[siteSlug]/self-service/SelfServiceProvider"
import { useRouter } from "next/navigation"
import { Html5Qrcode } from "html5-qrcode"
import { getSelfServiceModifierOptions } from "@/app/commerce/self-service-modifier-options-actions"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"
import { shopItem } from "./catalog-fixture"
import { LocalizationProvider } from "@/app/context/LocalizationContext"

jest.mock("@testing-library/react", () => {
  const actual = jest.requireActual("@testing-library/react")
  return { ...actual, render: (ui: React.ReactNode) => actual.render(ui, { wrapper: ({ children }: { children: React.ReactNode }) => <LocalizationProvider preferredLocale="en">{children}</LocalizationProvider> }) }
})

jest.mock("@/app/shop/[siteSlug]/self-service/SelfServiceProvider", () => ({ useSelfService: jest.fn() }))
jest.mock("@/app/shop/[siteSlug]/self-service/SelfServiceHeader", () => ({ SelfServiceHeader: () => <header>Self-service</header> }))
jest.mock("@/app/shop/[siteSlug]/ShopSiteFooter", () => ({ ShopSiteFooter: () => null }))
jest.mock("@/app/context/DisplayCurrencyContext", () => ({ useDisplayCurrency: () => ({ formatPrice: (price: number) => `$${price}` }) }))
jest.mock("@/app/components/commerce/PromptImage", () => ({ PromptImage: () => null }))
jest.mock("@/app/components/commerce/pdp/PdpItemDescription", () => ({ PdpItemDescription: () => null }))
jest.mock("@/app/components/commerce/pdp/VariantPicker", () => ({ VariantPicker: ({ onOptionSelect }: ComponentProps<typeof import("@/app/components/commerce/pdp/VariantPicker").VariantPicker>) => <button onClick={() => onOptionSelect("size", "small")}>Select small</button> }))
jest.mock("@/app/components/commerce/ModifierPickerPanel", () => ({
  isModifierSelectionValid: (_groups: unknown[], modifiers: unknown[]) => ({ ok: modifiers.length > 0 }),
  ModifierPickerPanel: ({ onChange }: ComponentProps<typeof import("@/app/components/commerce/ModifierPickerPanel").ModifierPickerPanel>) => <button onClick={() => onChange?.([{ groupId: "milk", catalogItemId: "oat", name: "Oat", cartQty: 1, cartPrice: 2 }])}>Select oat</button>,
}))
jest.mock("react-qr-code", () => ({ __esModule: true, default: ({ value }: { value: string }) => <div data-testid="order-qr">{value}</div> }))
jest.mock("html5-qrcode", () => ({ Html5Qrcode: jest.fn() }))
jest.mock("@/app/commerce/self-service-modifier-options-actions", () => ({ getSelfServiceModifierOptions: jest.fn() }))
const identity = jest.fn()
const addItem = jest.fn()
const push = jest.fn()
const product = { ...shopItem("coffee", "Coffee"), target_sale_price: 10 }
const state = { context: { site: { id: "site", name: "Shop", settings: {} }, location: { id: "branch", name: "Downtown" }, fulfillmentOptions: ["pickup", "dine_in"] }, fulfillment: "pickup", setIdentity: identity, addItem,
  cart: [{ ...product, cartQty: 1, cartPrice: 10 }], identity: null, promotion: null, ready: true }

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useSelfService).mockReturnValue(state as unknown as ReturnType<typeof useSelfService>)
  jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
  jest.mocked(getSelfServiceModifierOptions).mockResolvedValue({ data: [] })
  jest.mocked(Html5Qrcode).mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined), isScanning: true,
    stop: jest.fn().mockResolvedValue(undefined), clear: jest.fn(),
  }) as unknown as Html5Qrcode)
})

it("rejects raw user UUIDs and accepts only signed buyer syntax", () => {
  expect(isSignedBuyerCode("mf:user:00000000-0000-0000-0000-000000000000")).toBe(false)
  expect(isSignedBuyerCode("mf:buyer:payload.signature")).toBe(true)
  expect(isSignedBuyerCode("mf:buyer:payload")).toBe(false)
  expect(isSignedBuyerCode(`mf:buyer:${"x".repeat(1024)}.sig`)).toBe(false)
  render(<BuyerIdentityScan open onOpenChange={jest.fn()} />)
  fireEvent.change(screen.getByLabelText("Paste or type buyer code"), { target: { value: "mf:user:00000000-0000-0000-0000-000000000000" } })
  fireEvent.click(screen.getByRole("button", { name: "Verify buyer code" }))
  expect(screen.getByRole("alert")).toHaveTextContent("Raw user IDs are not accepted")
  expect(identity).not.toHaveBeenCalled()
})

it("verifies a pasted signed QR without sending session credentials or buyer ID", async () => {
  const fetch = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({ name: "Alex" }) } as Response)
  const close = jest.fn()
  render(<BuyerIdentityScan open onOpenChange={close} />)
  fireEvent.change(screen.getByLabelText("Paste or type buyer code"), { target: { value: "mf:buyer:payload.signature" } })
  fireEvent.click(screen.getByRole("button", { name: "Verify buyer code" }))
  await waitFor(() => expect(identity).toHaveBeenCalledWith({ code: "mf:buyer:payload.signature", name: "Alex" }))
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/commerce/buyer-identity"), expect.objectContaining({ credentials: "omit", body: JSON.stringify({ code: "mf:buyer:payload.signature", locationId: "branch" }) }))
  expect(close).toHaveBeenCalledWith(false)
  fetch.mockRestore()
})

it("keeps the pasted-code fallback available when camera permission is denied", async () => {
  const clear = jest.fn()
  jest.mocked(Html5Qrcode).mockImplementation(() => ({
    start: jest.fn().mockRejectedValue(new Error("Permission denied")), isScanning: false, clear,
  }) as unknown as Html5Qrcode)
  render(<BuyerIdentityScan open onOpenChange={jest.fn()} />)
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Camera unavailable"))
  expect(screen.getByLabelText("Paste or type buyer code")).toBeEnabled()
  expect(screen.getByRole("button", { name: "Use camera" })).toBeEnabled()
})

it("starts the camera on every opening and stops on close without a stop button", async () => {
  const start = jest.fn().mockResolvedValue(undefined)
  const stop = jest.fn().mockResolvedValue(undefined)
  jest.mocked(Html5Qrcode).mockImplementation(() => ({
    start, stop, isScanning: true, clear: jest.fn(),
  }) as unknown as Html5Qrcode)
  const close = jest.fn()
  const { rerender } = render(<BuyerIdentityScan open={false} onOpenChange={close} />)
  await act(async () => {})
  expect(start).not.toHaveBeenCalled()
  rerender(<BuyerIdentityScan open onOpenChange={close} />)
  await waitFor(() => expect(start).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole("button", { name: "Stop camera" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Use camera" })).not.toBeInTheDocument()
  rerender(<BuyerIdentityScan open={false} onOpenChange={close} />)
  await waitFor(() => expect(stop).toHaveBeenCalledTimes(1))
  rerender(<BuyerIdentityScan open onOpenChange={close} />)
  await waitFor(() => expect(start).toHaveBeenCalledTimes(2))
  rerender(<BuyerIdentityScan open={false} onOpenChange={close} />)
  await waitFor(() => expect(stop).toHaveBeenCalledTimes(2))
})

it("contains QR controls in a padded scrolling body and keeps actions in the dialog footer", () => {
  render(<BuyerIdentityScan open onOpenChange={jest.fn()} />)
  const dialog = screen.getByRole("dialog", { name: "Scan buyer QR" })
  const camera = screen.getByRole("region", { name: "Buyer QR camera" })
  const input = screen.getByLabelText("Paste or type buyer code")
  const body = dialog.querySelector('[data-slot="dialog-body"]')
  expect(body).toHaveClass("px-6", "py-4", "overflow-y-auto")
  expect(body).toContainElement(camera)
  expect(body).toContainElement(input)
  expect(input).toHaveAttribute("autocapitalize", "none")
  const footer = dialog.querySelector('[data-slot="dialog-footer"]')
  const submit = screen.getByRole("button", { name: "Verify buyer code" })
  expect(footer).toContainElement(submit)
  expect(footer).toContainElement(screen.getByRole("button", { name: "Continue anonymously" }))
  expect(submit).not.toHaveClass("w-full")
  expect(submit).toBeDisabled()
  expect(submit.closest("form")).toHaveAttribute("data-slot", "dialog-form")
})

it("stops the camera and clears the code when continuing anonymously", async () => {
  const stop = jest.fn().mockResolvedValue(undefined)
  const clear = jest.fn()
  jest.mocked(Html5Qrcode).mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined), isScanning: true, stop, clear,
  }) as unknown as Html5Qrcode)
  const close = jest.fn()
  render(<BuyerIdentityScan open onOpenChange={close} />)
  fireEvent.change(screen.getByLabelText("Paste or type buyer code"), { target: { value: "mf:buyer:payload.signature" } })
  await waitFor(() => expect(Html5Qrcode).toHaveBeenCalled())
  expect(screen.getByRole("region", { name: "Buyer QR camera" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "Continue anonymously" }))
  expect(close).toHaveBeenCalledWith(false)
  await waitFor(() => expect(stop).toHaveBeenCalled())
  expect(clear).toHaveBeenCalled()
  expect(screen.getByLabelText("Paste or type buyer code")).toHaveValue("")
  expect(identity).not.toHaveBeenCalled()
})

it("does not attach a late verification after continuing anonymously", async () => {
  let resolve!: (value: Response) => void
  const fetch = jest.spyOn(global, "fetch").mockImplementation(() => new Promise<Response>((done) => { resolve = done }))
  render(<BuyerIdentityScan open onOpenChange={jest.fn()} />)
  fireEvent.change(screen.getByLabelText("Paste or type buyer code"), { target: { value: "mf:buyer:payload.signature" } })
  fireEvent.click(screen.getByRole("button", { name: "Verify buyer code" }))
  expect(screen.getByRole("button", { name: "Verifying…" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Continue anonymously" }))
  await act(async () => { resolve({ ok: true, json: async () => ({ name: "Alex" }) } as Response) })
  expect(identity).not.toHaveBeenCalled()
  fetch.mockRestore()
})

it("shows the confirmation number and public token QR with phone card-pay instructions", async () => {
  const next = jest.fn()
  render(<SelfServiceConfirmation order={{ success: true, saleId: "sale", orderId: "order", publicAccessToken: "opaque-token", orderNumber: "1042", total: 20 }} onStartNew={next} />)
  await act(async () => {})
  expect(screen.getByText("1042")).toBeVisible()
  expect(screen.getByText("Cash payment pending")).toBeVisible()
  expect(screen.getByTestId("order-qr")).toHaveTextContent("/so/opaque-token")
  expect(screen.queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Start new order" }))
  expect(next).toHaveBeenCalled()
})

it("uses the authoritative free order total for payment messaging", async () => {
  render(<SelfServiceConfirmation order={{ success: true, saleId: "sale", orderId: "order", publicAccessToken: "opaque", total: 0, status: "completed" }} onStartNew={jest.fn()} />)
  await act(async () => {})
  expect(screen.getByText("No payment required")).toBeVisible()
  expect(screen.queryByText("Cash payment pending")).not.toBeInTheDocument()
})

it("keeps PDP variant/modifier selection and checkout in the location route without login", async () => {
  jest.mocked(getSelfServiceModifierOptions).mockResolvedValue({ data: [{ id: "milk" }] as ModifierGroupWithItems[] })
  const item = { ...product, _shop: { hasVariants: true, sellable: false, children: [{ ...product, id: "small", is_marketplace_listed: false, metadata: { option_values: { size: "small" } } }] },
    metadata: { pickup_location_ids: ["branch"], variant_axes: [{ id: "size", kind: "custom" as const, values: [{ id: "small", label: "Small" }] }] } }
  const { container } = render(<SelfServiceProductDetail item={item} modifierGroups={[]} />)
  expect(container.firstElementChild).toHaveClass("bg-background", "text-foreground")
  expect(screen.getByRole("heading", { level: 1, name: item.name })).toBeVisible()
  const decrease = screen.getByRole("button", { name: "Decrease quantity" })
  expect(decrease).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }))
  expect(decrease).toBeEnabled()
  expect(screen.getByRole("button", { name: /Add to order/ })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Select small" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "Select oat" })).toBeVisible())
  expect(getSelfServiceModifierOptions).toHaveBeenCalledWith({ locationId: "branch", hostId: "coffee", selectedId: "small", fulfillment: "pickup" })
  fireEvent.click(screen.getByRole("button", { name: "Select oat" }))
  fireEvent.click(screen.getByRole("button", { name: /Add to order/ }))
  expect(addItem).toHaveBeenCalledWith(expect.objectContaining({ id: "small", metadata: expect.objectContaining({ pickup_location_ids: ["branch"] }) }), 2,
    [{ groupId: "milk", catalogItemId: "oat", name: "Oat", cartQty: 1, cartPrice: 2 }])
  expect(push).toHaveBeenCalledWith("/shop/branch?cart=1")
  expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument()
})

it("uses the shared photo gallery without changing the kiosk order when previewing images", () => {
  const item = { ...product, image_url: "https://example.com/coffee.jpg", metadata: {
    gallery: ["https://example.com/menu.jpg"],
  } }
  render(<SelfServiceProductDetail item={item} modifierGroups={[]} />)
  const thumbnails = screen.getAllByRole("button", { name: /go to slide/i })
  expect(thumbnails).toHaveLength(2)
  expect(thumbnails[0]).toHaveAttribute("aria-pressed", "true")
  fireEvent.click(thumbnails[1])
  expect(thumbnails[1]).toHaveAttribute("aria-pressed", "true")
  expect(addItem).not.toHaveBeenCalled()
  expect(push).not.toHaveBeenCalled()
})

it("disables the host and explains when required options cannot be supplied", () => {
  const reason = "This item is unavailable: not enough options in Milk for this location and order type. Please choose another item or ask staff for help."
  render(<SelfServiceProductDetail item={product} modifierGroups={[]} modifierUnavailableReason={reason} />)
  expect(screen.getByRole("alert")).toHaveTextContent(reason)
  expect(screen.getByRole("button", { name: /Add to order/ })).toBeDisabled()
  expect(screen.queryByRole("button", { name: "Select oat" })).not.toBeInTheDocument()
})

it("never quick-applies coupons into the normal storefront cart", () => {
  render(<SelfServiceHero site={state.context.site} searchQuery="" locationId="branch" promos={[{ id: "offer", site_id: "site", name: "Coffee deal", discount_type: "percent", discount_value: 10, catalog_item_ids: [], category_ids: [] }]} />)
  expect(screen.getByRole("link")).toHaveAttribute("href", "/shop/branch/promo/offer")
  expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument()
})

it("offers signed buyer scan inside anonymous checkout without name/email or card entry fields", () => {
  render(<SelfServiceCart open onOpenChange={jest.fn()} onSuccess={jest.fn()} />)
  expect(screen.getByText("Ordering anonymously")).toBeVisible()
  expect(screen.getByRole("button", { name: "Place order · Pay at counter" })).toBeVisible()
  expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/card number/i)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Scan buyer QR (optional)" }))
  expect(screen.getByRole("dialog", { name: "Scan buyer QR" })).toBeVisible()
  expect(screen.getByLabelText("Paste or type buyer code")).toBeVisible()
})