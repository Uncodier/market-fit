import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { SubscriptionsList } from "@/app/subscriptions/components/SubscriptionsList"
import { deleteSubscription } from "@/app/subscriptions/delete-subscription"
import { updateSubscriptionStatus } from "@/app/subscriptions/actions"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import type { Subscription } from "@/app/types"

jest.mock("@/app/subscriptions/delete-subscription", () => ({ deleteSubscription: jest.fn() }))
jest.mock("@/app/subscriptions/actions", () => ({ updateSubscriptionStatus: jest.fn() }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
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
})