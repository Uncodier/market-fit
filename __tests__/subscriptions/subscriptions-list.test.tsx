import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { SubscriptionsList } from "@/app/subscriptions/components/SubscriptionsList"
import { deleteSubscription } from "@/app/subscriptions/delete-subscription"
import { updateSubscriptionStatus } from "@/app/subscriptions/actions"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import type { Subscription } from "@/app/types"
import { registerSubscriptionPayment } from "@/app/subscriptions/register-payment"

jest.mock("@/app/subscriptions/delete-subscription", () => ({ deleteSubscription: jest.fn() }))
jest.mock("@/app/subscriptions/actions", () => ({ updateSubscriptionStatus: jest.fn() }))
jest.mock("@/app/subscriptions/register-payment", () => ({ registerSubscriptionPayment: jest.fn() }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: jest.fn(() => null) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))

const subscription: Subscription = {
  id: "22222222-2222-4222-8222-222222222222",
  site_id: "11111111-1111-4111-8111-111111111111",
  lead_id: "lead-1",
  catalog_item_id: "plan-1",
  status: "cancelled",
  amount: 125,
  start_date: "2026-09-01",
  created_at: "2026-09-01T12:00:00Z",
  updated_at: "2026-09-01T12:00:00Z",
  catalog_item: { name: "Growth plan" },
  lead: { name: "Avery", email: "avery@example.com" },
}

function setup(status: Subscription["status"] = "cancelled") {
  const onUpdate = jest.fn()
  const props = { subscriptions: [{ ...subscription, status }], siteId: subscription.site_id, onUpdate }
  const view = render(<SubscriptionsList {...props} />)
  return { ...view, props, onUpdate }
}

async function openMenu(index = 0) {
  fireEvent.keyDown(screen.getAllByRole("button", { name: "Actions" })[index], { key: "ArrowDown" })
  return screen.findByRole("menu")
}

async function openDeleteDialog() {
  await openMenu()
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }))
  return screen.findByRole("alertdialog", { name: "Delete subscription?" })
}

describe("subscription options menu", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useOptionalPermissions).mockReturnValue(null)
    jest.mocked(deleteSubscription).mockResolvedValue({ success: true })
    jest.mocked(registerSubscriptionPayment).mockResolvedValue({ success: true })
    Object.defineProperty(crypto, "randomUUID", {
      configurable: true,
      value: jest.fn(() => "44444444-4444-4444-8444-444444444444"),
    })
  })

  it.each(["active", "paused", "expired"] as const)("does not offer deletion for %s subscriptions", async (status) => {
    setup(status)
    await openMenu()

    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument()
    expect(deleteSubscription).not.toHaveBeenCalled()
  })

  it("offers deletion for cancelled subscriptions without removing the existing activation option", async () => {
    setup()
    await openMenu()

    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveClass("text-destructive")
    expect(screen.getByRole("menuitem", { name: "Activate" })).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Cancel" })).not.toBeInTheDocument()
  })

  it("requires confirmation and lets the user cancel without deleting or navigating", async () => {
    const push = jest.fn()
    jest.mocked(useRouter).mockReturnValue({ ...useRouter(), push })
    const { onUpdate } = setup()
    const dialog = await openDeleteDialog()

    expect(within(dialog).getByText(/Growth plan for Avery/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Existing invoices and payments will be kept/)).toBeInTheDocument()
    expect(within(dialog).getByText(/cannot be undone/)).toBeInTheDocument()
    expect(deleteSubscription).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(deleteSubscription).not.toHaveBeenCalled()
    expect(onUpdate).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it("deletes the confirmed subscription and refreshes the list on success", async () => {
    const { onUpdate, rerender, props } = setup()
    const dialog = await openDeleteDialog()
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete subscription" }))

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
    expect(deleteSubscription).toHaveBeenCalledTimes(1)
    expect(deleteSubscription).toHaveBeenCalledWith(subscription.site_id, subscription.id)
    expect(updateSubscriptionStatus).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith("Subscription deleted")
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())

    rerender(<SubscriptionsList {...props} subscriptions={[]} />)
    expect(screen.getByText("No subscriptions found")).toBeInTheDocument()
  })

  it("deletes only the selected row when multiple subscriptions are listed", async () => {
    render(<SubscriptionsList
      subscriptions={[subscription, { ...subscription, id: "other-subscription", lead: { name: "Jordan" } }]}
      siteId={subscription.site_id}
      onUpdate={jest.fn()}
    />)
    await openMenu(1)
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/Growth plan for Jordan/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete subscription" }))

    await waitFor(() => expect(deleteSubscription).toHaveBeenCalledWith(subscription.site_id, "other-subscription"))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(deleteSubscription).toHaveBeenCalledTimes(1)
  })

  it.each(["returned", "thrown"])("keeps the dialog open for retry after a %s error", async (failure) => {
    if (failure === "returned") {
      jest.mocked(deleteSubscription).mockResolvedValueOnce({ error: "Subscription not found or no longer cancelled" })
    } else {
      jest.mocked(deleteSubscription).mockRejectedValueOnce(new Error("Connection failed"))
    }
    const { onUpdate } = setup()
    const dialog = await openDeleteDialog()
    const confirm = within(dialog).getByRole("button", { name: "Delete subscription" })
    fireEvent.click(confirm)

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(confirm).toBeEnabled())
    expect(dialog).toBeInTheDocument()
    expect(onUpdate).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    fireEvent.click(confirm)

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  })

  it("disables confirmation and dismissal while deleting to prevent duplicate requests", async () => {
    let finish!: (result: { success: boolean }) => void
    jest.mocked(deleteSubscription).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    setup()
    const dialog = await openDeleteDialog()
    const confirm = within(dialog).getByRole("button", { name: "Delete subscription" })
    fireEvent.click(confirm)

    expect(confirm).toBeDisabled()
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled()
    fireEvent.click(confirm)
    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(dialog).toBeInTheDocument()
    expect(deleteSubscription).toHaveBeenCalledTimes(1)

    await act(async () => finish({ success: true }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  })

  it("disables deletion when the user lacks delete permission", async () => {
    jest.mocked(useOptionalPermissions).mockReturnValue({
      siteId: subscription.site_id,
      capabilities: null,
      isViewOnly: true,
      can: (command) => command !== "delete",
    })
    setup()
    await openMenu()

    const deleteItem = screen.getByRole("menuitem", { name: "Delete" })
    expect(deleteItem).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(deleteItem)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(deleteSubscription).not.toHaveBeenCalled()
  })

  it("shows pending invoice counts and balances without mixing currencies", () => {
    render(<SubscriptionsList siteId={subscription.site_id} onUpdate={jest.fn()} subscriptions={[{
      ...subscription,
      pendingInvoices: [
        { id: "invoice-1", title: "September", invoiceNumber: "INV-1", amountDue: 25, currency: "USD" },
        { id: "invoice-2", title: "October", invoiceNumber: "INV-2", amountDue: 50, currency: "USD" },
        { id: "invoice-3", title: "Extra", invoiceNumber: null, amountDue: 30, currency: "EUR" },
      ],
    }]} />)
    expect(screen.getByRole("columnheader", { name: "Pending invoices" })).toBeInTheDocument()
    const row = screen.getByText("Avery").closest("tr")!
    expect(within(row).getByText("3 invoices")).toBeInTheDocument()
    expect(within(row).getByText("$75.00 due")).toBeInTheDocument()
    expect(within(row).getByText("€30.00 due")).toBeInTheDocument()
    expect(within(row).getAllByRole("cell")).toHaveLength(6)
  })

  it("disables payment registration when there are no pending invoices", async () => {
    setup("active")
    await openMenu()
    const action = screen.getByRole("menuitem", { name: "Register payment" })
    expect(action).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(action)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("registers a partial payment from the selected subscription without navigating", async () => {
    const onUpdate = jest.fn()
    const push = jest.fn()
    jest.mocked(useRouter).mockReturnValue({ ...useRouter(), push })
    render(<SubscriptionsList siteId={subscription.site_id} onUpdate={onUpdate} subscriptions={[{
      ...subscription,
      pendingInvoices: [{ id: "33333333-3333-4333-8333-333333333333", title: "September", invoiceNumber: "INV-1", amountDue: 125, currency: "USD" }],
    }]} />)
    await openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: "Register payment" }))
    const dialog = await screen.findByRole("dialog", { name: "Register payment" })
    expect(within(dialog).getByLabelText("Payment amount")).toHaveValue(125)
    fireEvent.change(within(dialog).getByLabelText("Payment amount"), { target: { value: "25" } })
    fireEvent.change(within(dialog).getByLabelText("Notes"), { target: { value: "Deposit" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Register payment" }))
    await waitFor(() => expect(registerSubscriptionPayment).toHaveBeenCalledWith({
      siteId: subscription.site_id, subscriptionId: subscription.id,
      invoiceId: "33333333-3333-4333-8333-333333333333",
      requestId: "44444444-4444-4444-8444-444444444444",
      amount: 25, method: "credit_card", notes: "Deposit",
    }))
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it("disables payment registration without update permission", async () => {
    jest.mocked(useOptionalPermissions).mockReturnValue({
      siteId: subscription.site_id, capabilities: null, isViewOnly: true, can: () => false,
    })
    render(<SubscriptionsList siteId={subscription.site_id} onUpdate={jest.fn()} subscriptions={[{
      ...subscription,
      pendingInvoices: [{ id: "invoice", title: "September", invoiceNumber: null, amountDue: 25, currency: "USD" }],
    }]} />)
    await openMenu()
    expect(screen.getByRole("menuitem", { name: "Register payment" })).toHaveAttribute("aria-disabled", "true")
  })

  it("keeps payment details for retry and prevents duplicate submissions while saving", async () => {
    let finish!: (result: { error: string }) => void
    jest.mocked(registerSubscriptionPayment).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    const onUpdate = jest.fn()
    render(<SubscriptionsList siteId={subscription.site_id} onUpdate={onUpdate} subscriptions={[{
      ...subscription,
      pendingInvoices: [{ id: "invoice", title: "September", invoiceNumber: null, amountDue: 25, currency: "USD" }],
    }]} />)
    await openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: "Register payment" }))
    const dialog = await screen.findByRole("dialog")
    const confirm = within(dialog).getByRole("button", { name: "Register payment" })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(within(dialog).getByRole("button", { name: "Processing..." })).toBeDisabled()
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled()
    expect(registerSubscriptionPayment).toHaveBeenCalledTimes(1)
    await act(async () => finish({ error: "Invoice changed. Reload and retry." }))
    expect(dialog).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith("Invoice changed. Reload and retry.")
    expect(onUpdate).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole("button", { name: "Register payment" }))
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
    const calls = jest.mocked(registerSubscriptionPayment).mock.calls
    expect(calls[0][0].requestId).toBe(calls[1][0].requestId)
  })

  it("locks interrupted payment details until the identical request is confirmed", async () => {
    jest.mocked(registerSubscriptionPayment).mockRejectedValueOnce(new Error("Connection interrupted"))
    render(<SubscriptionsList siteId={subscription.site_id} onUpdate={jest.fn()} subscriptions={[{
      ...subscription,
      pendingInvoices: [{ id: "invoice", title: "September", invoiceNumber: null, amountDue: 25, currency: "USD" }],
    }]} />)
    await openMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: "Register payment" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Register payment" }))
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("Payment confirmation was interrupted"))
    expect(within(dialog).getByLabelText("Payment amount")).toBeDisabled()
    expect(within(dialog).getByLabelText("Notes")).toBeDisabled()
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled()
    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(dialog).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Register payment" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(jest.mocked(registerSubscriptionPayment).mock.calls[0][0])
      .toEqual(jest.mocked(registerSubscriptionPayment).mock.calls[1][0])
  })
})