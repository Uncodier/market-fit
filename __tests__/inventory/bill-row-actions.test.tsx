import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { BillRowActions } from "@/app/bills/components/BillRowActions"
import { getPurchaseById, publishPurchase } from "@/app/purchases/actions"
import type { Purchase } from "@/app/types"

jest.mock("@/app/components/auth/auth-context", () => ({ useAuthContext: () => ({ user: { id: "actor-one" } }) }))

let mockSiteId = "site-one"
let mockCanWrite = true
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: mockSiteId } }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => ({ can: () => mockCanWrite }) }))
jest.mock("@/app/purchases/actions", () => ({ getPurchaseById: jest.fn(), publishPurchase: jest.fn(), unpublishPurchase: jest.fn() }))
jest.mock("@/app/bills/send-actions", () => ({ ensureBillPublicAccessToken: jest.fn(), sendVendorBill: jest.fn() }))
jest.mock("@/app/bills/components/CreatePurchaseDialog", () => ({ CreatePurchaseDialog: () => <div role="dialog">Edit bill</div> }))
jest.mock("@/app/bills/components/RegisterPurchasePaymentDialog", () => ({ RegisterPurchasePaymentDialog: () => <div role="dialog">Payment bill</div> }))
jest.mock("@/app/bills/components/ReceivePurchaseStockDialog", () => ({ ReceivePurchaseStockDialog: () => <div role="dialog">Receive bill</div> }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }))
const bill = { id: "bill-one", siteId: "site-one", title: "Materials", status: "pending", amountDue: 50, accountingState: "pending", stockReceived: false } as Purchase
function setup(purchase = bill) {
  const onUpdate = jest.fn(), onOpen = jest.fn(), onDelete = jest.fn()
  render(<BillRowActions purchase={purchase} onUpdate={onUpdate} onOpen={onOpen} onDelete={onDelete} />)
  fireEvent.keyDown(screen.getByRole("button", { name: "Bill actions: Materials" }), { key: "Enter" })
  return { onUpdate, onOpen, onDelete }
}
beforeEach(() => {
  jest.clearAllMocks(); mockSiteId = "site-one"; mockCanWrite = true
  jest.mocked(getPurchaseById).mockResolvedValue({ purchase: bill, error: null })
  jest.mocked(publishPurchase).mockResolvedValue({ error: null })
})
it("includes detail toolbar actions in the row options", async () => {
  setup()
  for (const name of ["Open", "Edit", "Register payment", "Receive stock", "Print", "Send", "Vendor Link", "Publish", "Delete"]) {
    expect(await screen.findByRole("menuitem", { name })).toBeInTheDocument()
  }
})
it.each([["Edit", "Edit bill"], ["Register payment", "Payment bill"], ["Receive stock", "Receive bill"]])("opens the existing %s dialog after a fresh bill read", async (action, text) => {
  setup()
  fireEvent.click(await screen.findByRole("menuitem", { name: action }))
  expect(await screen.findByRole("dialog")).toHaveTextContent(text)
  expect(getPurchaseById).toHaveBeenCalledWith("site-one", "bill-one")
})
it("publishes using the existing action and refreshes the list", async () => {
  const { onUpdate } = setup()
  fireEvent.click(await screen.findByRole("menuitem", { name: "Publish" }))
  await waitFor(() => expect(publishPurchase).toHaveBeenCalledWith("site-one", "bill-one"))
  await waitFor(() => expect(onUpdate).toHaveBeenCalled())
})
it("rechecks payment state before opening a stale list action", async () => {
  jest.mocked(getPurchaseById).mockResolvedValue({ purchase: { ...bill, amountDue: 0 }, error: null })
  setup()
  fireEvent.click(await screen.findByRole("menuitem", { name: "Register payment" }))
  await waitFor(() => expect(getPurchaseById).toHaveBeenCalled())
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})
it.each(["demo", "viewer"])("disables mutations for %s while preserving Open", async mode => {
  if (mode === "demo") mockSiteId = "demo-site"
  else mockCanWrite = false
  setup(mode === "demo" ? { ...bill, siteId: "demo-site" } : bill)
  expect(await screen.findByRole("menuitem", { name: "Edit" })).toHaveAttribute("aria-disabled", "true")
  expect(screen.getByRole("menuitem", { name: "Open" })).not.toHaveAttribute("aria-disabled", "true")
  expect(getPurchaseById).not.toHaveBeenCalled()
})
it("hides payment, receipt and send for cancelled bills", async () => {
  setup({ ...bill, status: "cancelled" })
  await screen.findByRole("menuitem", { name: "Open" })
  for (const name of ["Register payment", "Receive stock", "Send"]) expect(screen.queryByRole("menuitem", { name })).not.toBeInTheDocument()
})