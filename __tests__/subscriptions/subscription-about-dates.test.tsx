import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { format } from "date-fns"
import { toast } from "sonner"
import { SubscriptionAboutPanel } from "@/app/subscriptions/components/SubscriptionAboutPanel"
import type { SubscriptionDetail } from "@/app/subscriptions/actions"
import messages from "@/app/context/locales/en.json"

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ locale: "en", t: (key: string) => messages[key as keyof typeof messages] || key }),
}))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: () => false }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => null }))

const subscription: SubscriptionDetail = {
  id: "22222222-2222-4222-8222-222222222222",
  site_id: "11111111-1111-4111-8111-111111111111",
  lead_id: "lead-1", catalog_item_id: "plan-1", status: "active", amount: 125,
  start_date: "2026-09-01", next_billing_date: "2026-10-20T00:00:00Z", due_date: "2026-11-03",
  created_at: "2026-09-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z",
  lead: { id: "lead-1", name: "Avery", email: null, phone: null, status: "qualified" },
  catalog_item: { id: "plan-1", name: "Growth plan", description: null, kind: "service" },
}

function setup(overrides: Partial<SubscriptionDetail> = {}) {
  const onUpdateNextBillingDate = jest.fn().mockResolvedValue(undefined)
  const onUpdateDueDate = jest.fn().mockResolvedValue(undefined)
  const onUpdateAmount = jest.fn().mockResolvedValue(undefined)
  const onUpdateEndDate = jest.fn().mockResolvedValue(undefined)
  const props = { subscription: { ...subscription, ...overrides }, currency: "USD", invoices: [], onUpdateNextBillingDate, onUpdateDueDate, onUpdateAmount, onUpdateEndDate }
  return { ...render(<SubscriptionAboutPanel {...props} />), props, onUpdateNextBillingDate, onUpdateDueDate }
}

function saveButton(label: string) {
  return screen.getByRole("button", { name: `Save ${label.toLowerCase()}` })
}

function cancelButton(label: string) {
  return screen.getByRole("button", { name: `Cancel ${label.toLowerCase()} edit` })
}

describe("inline subscription dates", () => {
  beforeEach(() => jest.clearAllMocks())

  it.each([
    ["Next billing", "Oct 20, 2026", new Date(2026, 9, 21), "2026-10-21"],
    ["Due date", "Nov 3, 2026", new Date(2026, 10, 4), "2026-11-04"],
  ] as const)("edits %s with the shared calendar and saves only on confirmation", async (label, display, next, expected) => {
    const { onUpdateNextBillingDate, onUpdateDueDate } = setup()
    const commit = label === "Next billing" ? onUpdateNextBillingDate : onUpdateDueDate
    fireEvent.click(screen.getByText(display))
    const picker = screen.getByLabelText(label)
    expect(picker).toHaveClass("h-8")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.click(picker)
    fireEvent.click(screen.getByRole("button", { name: format(next, "PPPP") }))
    expect(commit).not.toHaveBeenCalled()
    fireEvent.click(saveButton(label))
    await waitFor(() => expect(commit).toHaveBeenCalledWith(expected))
    await waitFor(() => expect(screen.queryByLabelText(label)).not.toBeInTheDocument())
    expect(label === "Next billing" ? onUpdateDueDate : onUpdateNextBillingDate).not.toHaveBeenCalled()
  })

  it("cancels a draft without saving", () => {
    const { onUpdateNextBillingDate } = setup()
    fireEvent.click(screen.getByText("Oct 20, 2026"))
    const picker = screen.getByLabelText("Next billing")
    fireEvent.click(picker)
    fireEvent.click(screen.getByRole("button", { name: format(new Date(2026, 9, 21), "PPPP") }))
    fireEvent.click(cancelButton("Next billing"))
    expect(screen.getByText("Oct 20, 2026")).toBeInTheDocument()
    expect(onUpdateNextBillingDate).not.toHaveBeenCalled()
  })

  it("clears due date only after confirming the change", async () => {
    const { onUpdateDueDate } = setup()
    fireEvent.click(screen.getByText("Nov 3, 2026"))
    const picker = screen.getByLabelText("Due date")
    fireEvent.click(screen.getByRole("button", { name: "Clear due date" }))
    expect(picker).toHaveTextContent("Select due date")
    expect(onUpdateDueDate).not.toHaveBeenCalled()
    fireEvent.click(saveButton("Due date"))
    await waitFor(() => expect(onUpdateDueDate).toHaveBeenCalledWith(""))
  })

  it("keeps missing dates visible and editable", () => {
    setup({ next_billing_date: undefined, due_date: null })
    const dates = screen.getAllByText("Not set")
    expect(dates).toHaveLength(3)
    fireEvent.click(dates[0])
    expect(screen.getByLabelText("Next billing")).toHaveTextContent("Select next billing")
    expect(screen.queryByRole("button", { name: "Clear next billing" })).not.toBeInTheDocument()
  })

  it("displays legacy timestamps using their UTC calendar day", () => {
    setup({ next_billing_date: "2026-10-20T23:00:00-05:00" })
    fireEvent.click(screen.getByText("Oct 21, 2026"))
    expect(screen.getByLabelText("Next billing")).toHaveTextContent("Oct 21, 2026")
  })

  it("retains the editor for retry after a failed save", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {})
    const { onUpdateDueDate } = setup()
    onUpdateDueDate.mockRejectedValueOnce(new Error("Unable to save"))
    fireEvent.click(screen.getByText("Nov 3, 2026"))
    const picker = screen.getByLabelText("Due date")
    const save = saveButton("Due date")
    fireEvent.click(save)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not save field"))
    expect(picker).toBeInTheDocument()
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.click(save)
    await waitFor(() => expect(screen.queryByLabelText("Due date")).not.toBeInTheDocument())
    jest.restoreAllMocks()
  })

  it("disables save and cancel while saving", async () => {
    let finish!: () => void
    const { onUpdateNextBillingDate } = setup()
    onUpdateNextBillingDate.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve }))
    fireEvent.click(screen.getByText("Oct 20, 2026"))
    const save = saveButton("Next billing")
    const cancel = cancelButton("Next billing")
    fireEvent.click(save)
    expect(save).toBeDisabled()
    expect(cancel).toBeDisabled()
    fireEvent.click(save)
    expect(onUpdateNextBillingDate).toHaveBeenCalledTimes(1)
    await act(async () => finish())
    await waitFor(() => expect(screen.queryByLabelText("Next billing")).not.toBeInTheDocument())
  })

  it.each([
    ["Next billing", "Oct 20, 2026"],
    ["Due date", "Nov 3, 2026"],
  ])("keeps the %s picker full-width with separate non-shrinking actions", (label, display) => {
    setup()
    fireEvent.click(screen.getByText(display))
    const picker = screen.getByLabelText(label)
    const save = saveButton(label)
    const cancel = cancelButton(label)
    const editor = save.parentElement!

    expect(editor).toHaveClass("min-w-0", "flex-wrap", "justify-end")
    expect(editor.firstElementChild).toHaveClass("w-full", "min-w-0")
    expect(editor.firstElementChild).toContainElement(picker)
    expect(save).toHaveClass("shrink-0", "w-7")
    expect(cancel).toHaveClass("shrink-0", "w-7")
    expect(picker).toHaveClass("w-full", "min-w-0")
    expect(picker).toHaveAttribute("title", display)
    expect(within(picker).getByText(display)).toHaveClass("truncate", "min-w-0")
    expect(document.getElementById(picker.getAttribute("aria-describedby")!)).toBeInTheDocument()
  })
})