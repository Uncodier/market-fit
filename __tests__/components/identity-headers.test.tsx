import React, { useState } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { toast } from "sonner"
import { CampaignIdentityHeader } from "@/app/components/campaign-detail/campaign-identity-header"
import { DealIdentityHeader } from "@/app/deals/components/DealIdentityHeader"
import { updateDeal } from "@/app/deals/actions"
import type { Campaign } from "@/app/types"
import type { Deal } from "@/app/deals/types"

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => null }))
jest.mock("@/app/components/documents/document-list", () => ({ EntityAvatar: () => null }))
jest.mock("@/app/components/ui/icons", () => ({
  ClipboardList: () => null, ExternalLink: () => null, User: () => null,
  FileText: () => null, ShoppingCart: () => null,
}))
jest.mock("@/app/components/create-requirement-dialog-for-campaign", () => ({ CampaignRequirementDialog: () => null }))
jest.mock("@/app/components/add-campaign-lead-dialog", () => ({ AddCampaignLeadDialog: () => null }))
jest.mock("@/app/deals/components/LinkTeamMemberDialog", () => ({ LinkTeamMemberDialog: () => null }))
jest.mock("@/app/deals/components/use-deal-commerce", () => ({
  useDealCommerce: () => ({ isCreatingQuote: false, isCreatingSale: false }),
}))
jest.mock("@/app/deals/actions", () => ({ updateDeal: jest.fn() }))

const initial = "Original name"
const edited = "Edited name"
const campaign: Campaign = {
  id: "campaign-1", title: initial, description: "", priority: "medium", status: "active",
  dueDate: "", assignees: 0, issues: 0, type: "inbound", siteId: "site-1", userId: "user-1",
  createdAt: "", updatedAt: "", budget: { allocated: 0, remaining: 0, currency: "USD" },
  revenue: { actual: 0, projected: 0, estimated: 0, currency: "USD" },
}
const deal: Deal = {
  id: "deal-1", name: initial, amount: 0, currency: "USD", stage: "prospecting", status: "open",
  company_id: null, company: null, site_id: "site-1", expected_close_date: null,
  notes: null, qualification_score: null, qualification_criteria: {}, sales_order_id: null,
  accepted_quotation_id: null, created_at: "", updated_at: "",
}
type Kind = "campaign" | "deal"
type Result = { error: string | null; deal: Deal | null; campaign: Campaign | null }
const success = (name = edited): Result => ({
  error: null, deal: { ...deal, name }, campaign: { ...campaign, title: name },
})

function deferred() {
  let resolve!: (value: Result) => void
  let reject!: (error: Error) => void
  const promise = new Promise<Result>((accept, fail) => { resolve = accept; reject = fail })
  return { promise, resolve, reject }
}

function mount(kind: Kind) {
  const mutation = jest.fn<Promise<Result>, [Record<string, unknown>]>().mockResolvedValue(success())
  const published = jest.fn()
  jest.mocked(updateDeal).mockImplementation(async data => {
    const result = await mutation(data)
    return result as Awaited<ReturnType<typeof updateDeal>>
  })

  function Parent({ tick = 0 }: { tick?: number }) {
    const [currentCampaign, setCampaign] = useState(campaign)
    const [currentDeal, setDeal] = useState(deal)
    return (
      <form onSubmit={event => event.preventDefault()}>
        <span>{tick}</span>
        {kind === "campaign" ? (
          <CampaignIdentityHeader
            campaign={{ ...currentCampaign }}
            siteSegments={[]}
            onUpdate={async data => {
              const result = await mutation(data)
              if (result.error) return { error: result.error }
              if (result.campaign) {
                published(result.campaign)
                setCampaign(result.campaign)
              }
            }}
            onCreateRequirement={async () => ({})}
            onReloadLeads={() => {}}
          />
        ) : (
          <DealIdentityHeader
            deal={{ ...currentDeal }}
            onUpdate={updated => { published(updated); setDeal(updated) }}
          />
        )}
        <button type="button">Outside</button>
      </form>
    )
  }
  const view = render(<Parent />)
  const editLabel = kind === "campaign" ? "Edit campaign title" : "Edit deal name"
  const inputLabel = kind === "campaign" ? "Campaign title" : "Deal name"
  const open = () => {
    fireEvent.click(screen.getByRole("button", { name: editLabel }))
    return screen.getByRole("textbox", { name: inputLabel })
  }
  return {
    mutation, published, open,
    rerender: () => view.rerender(<Parent tick={1} />),
    editButton: () => screen.getByRole("button", { name: editLabel }),
    payload: (name: string) => kind === "campaign" ? { title: name } : { id: deal.id, name },
  }
}

beforeEach(() => jest.clearAllMocks())

describe.each<Kind>(["campaign", "deal"])("%s inline identity editor", kind => {
  it("preserves one level-one heading with a focusable, borderless edit button", () => {
    const ui = mount(kind)
    const heading = screen.getByRole("heading", { name: initial, level: 1 })
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(heading).toContainElement(ui.editButton())
    expect(ui.editButton()).toHaveAttribute("type", "button")
    ui.editButton().focus()
    expect(ui.editButton()).toHaveFocus()
    expect(ui.open()).toHaveFocus()
    expect(ui.mutation).not.toHaveBeenCalled()
  })

  it("coalesces same-tick Enter and blur and repeated Enter until the save resolves", async () => {
    const ui = mount(kind)
    const pending = deferred()
    ui.mutation.mockReturnValueOnce(pending.promise)
    const input = ui.open()
    fireEvent.change(input, { target: { value: `  ${edited}  ` } })
    act(() => {
      fireEvent.keyDown(input, { key: "Enter" })
      fireEvent.blur(input)
      fireEvent.keyDown(input, { key: "Enter" })
    })
    expect(ui.mutation).toHaveBeenCalledTimes(1)
    expect(ui.mutation).toHaveBeenCalledWith(ui.payload(edited))
    expect(input).toHaveAttribute("readonly")
    expect(input).toHaveAttribute("aria-busy", "true")
    expect(ui.published).not.toHaveBeenCalled()
    ui.rerender()
    expect(input).toHaveValue(`  ${edited}  `)
    await act(async () => pending.resolve(success()))
    expect(ui.published).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("heading", { name: edited, level: 1 })).toBeVisible()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    fireEvent.blur(input)
    expect(ui.mutation).toHaveBeenCalledTimes(1)
    ui.rerender()
    expect(ui.open()).toHaveValue(edited)
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" })
    expect(ui.mutation).toHaveBeenCalledTimes(1)
  })

  it("uses the returned server value, restores keyboard focus, and does not resurrect the submitted draft", async () => {
    const ui = mount(kind)
    ui.mutation.mockResolvedValueOnce(success("Server canonical name"))
    const input = ui.open()
    fireEvent.change(input, { target: { value: edited } })
    await act(async () => fireEvent.keyDown(input, { key: "Enter" }))
    expect(screen.getByRole("heading", { name: "Server canonical name", level: 1 })).toBeVisible()
    expect(ui.editButton()).toHaveFocus()
    ui.rerender()
    expect(ui.open()).toHaveValue("Server canonical name")
    expect(ui.mutation).toHaveBeenCalledTimes(1)
  })

  it("saves on blur once without stealing focus from the next control", async () => {
    const ui = mount(kind)
    const input = ui.open()
    fireEvent.change(input, { target: { value: edited } })
    await act(async () => screen.getByRole("button", { name: "Outside" }).focus())
    expect(ui.mutation).toHaveBeenCalledTimes(1)
    expect(ui.published).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus()
  })

  it.each(["rejection", "returned error"])("retains the draft after %s and requires Enter for retry, not blur or rerender", async failure => {
    const ui = mount(kind)
    const pending = deferred()
    ui.mutation.mockReturnValueOnce(pending.promise)
    const input = ui.open()
    fireEvent.change(input, { target: { value: edited } })
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.blur(input)
    await act(async () => {
      if (failure === "rejection") pending.reject(new Error("Offline"))
      else pending.resolve({ ...success(), error: "Denied" })
    })
    expect(ui.published).not.toHaveBeenCalled()
    expect(input).toHaveValue(edited)
    expect(input).not.toHaveAttribute("readonly")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAttribute("aria-describedby", screen.getByRole("alert").id)
    expect(screen.getByRole("alert")).toHaveTextContent("Press Enter to retry or Escape to cancel")
    expect(toast.error).toHaveBeenCalledTimes(1)
    ui.rerender()
    fireEvent.blur(input)
    fireEvent.change(input, { target: { value: "Explicit retry" } })
    fireEvent.blur(input)
    expect(input).toHaveValue("Explicit retry")
    expect(ui.mutation).toHaveBeenCalledTimes(1)
    ui.mutation.mockResolvedValueOnce(success("Explicit retry"))
    await act(async () => fireEvent.keyDown(input, { key: "Enter" }))
    expect(ui.mutation).toHaveBeenCalledTimes(2)
    expect(ui.mutation).toHaveBeenLastCalledWith(ui.payload("Explicit retry"))
    expect(ui.published).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("heading", { name: "Explicit retry", level: 1 })).toBeVisible()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it.each(["", "   ", initial, `  ${initial}  `])("cancels empty/unchanged draft %j without a mutation or stale blur save", draft => {
    const ui = mount(kind)
    const input = ui.open()
    fireEvent.change(input, { target: { value: draft } })
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.blur(input)
    expect(ui.mutation).not.toHaveBeenCalled()
    expect(screen.getByRole("heading", { name: initial, level: 1 })).toBeVisible()
    expect(ui.editButton()).toHaveFocus()
    ui.rerender()
    expect(ui.open()).toHaveValue(initial)
  })

  it("Escape cancels without mutation, restores focus, and discards the draft across parent rerenders", () => {
    const ui = mount(kind)
    const input = ui.open()
    fireEvent.change(input, { target: { value: edited } })
    ui.rerender()
    expect(input).toHaveValue(edited)
    fireEvent.keyDown(input, { key: "Escape" })
    fireEvent.blur(input)
    expect(ui.editButton()).toHaveFocus()
    expect(ui.mutation).not.toHaveBeenCalled()
    ui.rerender()
    expect(ui.open()).toHaveValue(initial)
  })

  it("Escape cannot pretend to cancel an already dispatched save", async () => {
    const ui = mount(kind)
    const pending = deferred()
    ui.mutation.mockReturnValueOnce(pending.promise)
    const input = ui.open()
    fireEvent.change(input, { target: { value: edited } })
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.keyDown(input, { key: "Escape" })
    fireEvent.blur(input)
    expect(input).toHaveAttribute("aria-busy", "true")
    expect(ui.mutation).toHaveBeenCalledTimes(1)
    await act(async () => pending.resolve(success()))
    expect(screen.getByRole("heading", { name: edited, level: 1 })).toBeVisible()
    expect(ui.mutation).toHaveBeenCalledTimes(1)
  })

  it("does not save while Enter confirms IME composition", () => {
    const ui = mount(kind)
    const input = ui.open()
    fireEvent.change(input, { target: { value: edited } })
    fireEvent.keyDown(input, { key: "Enter", isComposing: true })
    expect(ui.mutation).not.toHaveBeenCalled()
    expect(input).toHaveValue(edited)
  })
})

it("does not complete a deal rename without a returned deal", async () => {
  const ui = mount("deal")
  ui.mutation.mockResolvedValueOnce({ ...success(), deal: null })
  const input = ui.open()
  fireEvent.change(input, { target: { value: edited } })
  await act(async () => fireEvent.keyDown(input, { key: "Enter" }))
  expect(input).toHaveValue(edited)
  expect(screen.getByRole("alert")).toBeVisible()
  expect(ui.published).not.toHaveBeenCalled()
  fireEvent.blur(input)
  expect(ui.mutation).toHaveBeenCalledTimes(1)
})