import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { LeadRowMenu } from "@/app/leads/components/lead-row-menu"
import { LeadActionsMenu } from "@/app/leads/components/LeadActionsMenu"
import { getLeadOpenInvoices } from "@/app/leads/payment-actions"
import type { Lead } from "@/app/leads/types"

let mockCanUpdate = true
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-a" } }) }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => ({ can: () => mockCanUpdate }) }))
jest.mock("@/app/leads/payment-actions", () => ({ getLeadOpenInvoices: jest.fn(), registerLeadInvoicePayment: jest.fn() }))

const lead = { id: "lead-a", name: "Alex Smith" } as Lead
const actionLabel = "Settle balance / Add payment"

function setup(kind: "row" | "detail", leadCount = 1, loading: "research" | null = null) {
  const handlers = {
    onResearch: jest.fn(), onFollowUp: jest.fn(), onInvalidate: jest.fn(),
    onEdit: jest.fn(), onConversation: jest.fn(), onDelete: jest.fn(),
  }
  const rowClick = jest.fn()
  render(<div onClick={rowClick}>
    {kind === "row" ? <LeadRowMenu lead={lead} leadCount={leadCount} loading={loading} success={null} {...handlers} />
      : <LeadActionsMenu lead={lead} loading={loading} {...handlers} />}
  </div>)
  return { handlers, rowClick }
}

function openMenu(kind: "row" | "detail") {
  fireEvent.keyDown(screen.getByRole("button", { name: kind === "row" ? "Open actions" : "Open menu" }), { key: "Enter", code: "Enter" })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCanUpdate = true
  jest.mocked(getLeadOpenInvoices).mockResolvedValue({ snapshot: { invoices: [], version: "a".repeat(32) } })
})

describe.each(["row", "detail"] as const)("%s lead menu payment wiring", kind => {
  it("does not preload and opens the shared portal outside the closed menu", async () => {
    const { rowClick } = setup(kind)
    expect(getLeadOpenInvoices).not.toHaveBeenCalled()
    openMenu(kind)
    expect(getLeadOpenInvoices).not.toHaveBeenCalled()
    expect(screen.getAllByRole("menuitem", { name: actionLabel })).toHaveLength(1)
    fireEvent.click(screen.getByRole("menuitem", { name: actionLabel }))
    await screen.findByText("No open invoice balance")
    expect(screen.getByRole("dialog")).toHaveTextContent("Alex Smith")
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    expect(getLeadOpenInvoices).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText("No open invoice balance"))
    if (kind === "row") expect(rowClick).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it.each([
    ["Lead Research", "onResearch"], ["Lead Follow Up", "onFollowUp"],
    ["Lead Invalidation", "onInvalidate"], ["New Conversation", "onConversation"],
    ["Delete Lead", "onDelete"],
  ] as const)("preserves the %s action", (label, callback) => {
    const { handlers } = setup(kind)
    openMenu(kind)
    fireEvent.click(screen.getByRole("menuitem", { name: label }))
    expect(handlers[callback]).toHaveBeenCalledTimes(1)
    expect(getLeadOpenInvoices).not.toHaveBeenCalled()
  })

  it("preserves editing and in-progress action disabling", () => {
    const { handlers } = setup(kind, 1, "research")
    openMenu(kind)
    expect(screen.getByRole("menuitem", { name: "Lead Research" })).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(screen.getByRole("menuitem", { name: kind === "row" ? "Edit Lead" : "Edit fields" }))
    expect(handlers.onEdit).toHaveBeenCalledTimes(1)
  })

  it("disables recording for read-only permissions", () => {
    mockCanUpdate = false
    setup(kind)
    openMenu(kind)
    const item = screen.getByRole("menuitem", { name: actionLabel })
    expect(item).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(item)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(getLeadOpenInvoices).not.toHaveBeenCalled()
  })
})

it("hides payment on multi-lead aggregates without changing bulk actions", () => {
  const { handlers } = setup("row", 3)
  openMenu("row")
  expect(screen.queryByRole("menuitem", { name: actionLabel })).not.toBeInTheDocument()
  expect(screen.getByRole("menuitem", { name: "Follow-up all 3 leads" })).toBeInTheDocument()
  expect(screen.getByRole("menuitem", { name: "Invalidate all 3 leads" })).toBeInTheDocument()
  fireEvent.click(screen.getByRole("menuitem", { name: "Research all 3 leads" }))
  expect(handlers.onResearch).toHaveBeenCalledTimes(1)
  expect(getLeadOpenInvoices).not.toHaveBeenCalled()
})