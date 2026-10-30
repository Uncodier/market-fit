import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CommerceView } from "@/app/leads/components/CommerceView"
import { getLeadCommerce } from "@/app/leads/commerce-actions"
import type { LeadCommerceResult } from "@/app/leads/commerce-types"

let siteId = "site-a"
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: siteId } }) }))
jest.mock("@/app/leads/commerce-actions", () => ({ getLeadCommerce: jest.fn() }))

const row = { id: "quote-a", title: "Quote A", href: "/quotations/quote-a", date: "2026-10-29", amount: 100, currency: "USD", status: "sent" }

beforeEach(() => {
  siteId = "site-a"
  jest.clearAllMocks()
  jest.mocked(getLeadCommerce).mockResolvedValue({ rows: [row], count: 1 })
})

it("shows customer commerce links, switches sections and paginates", async () => {
  jest.mocked(getLeadCommerce).mockResolvedValue({ rows: [row], count: 26 })
  render(<CommerceView leadId="lead-a" />)
  expect(await screen.findByRole("link", { name: "Quote A" })).toHaveAttribute("href", row.href)
  fireEvent.click(screen.getByRole("button", { name: "Next" }))
  await waitFor(() => expect(getLeadCommerce).toHaveBeenLastCalledWith({ siteId, leadId: "lead-a", kind: "quotations", page: 2 }))
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Purchases" }), { button: 0, ctrlKey: false })
  await waitFor(() => expect(getLeadCommerce).toHaveBeenLastCalledWith({ siteId, leadId: "lead-a", kind: "purchases", page: 1 }))
  expect(screen.getByText("Customer orders placed with this workspace.")).toBeInTheDocument()
})

it("distinguishes errors from empty results and allows retry", async () => {
  jest.mocked(getLeadCommerce).mockResolvedValueOnce({ error: "Access denied" }).mockResolvedValueOnce({ rows: [], count: 0 })
  render(<CommerceView leadId="lead-a" />)
  expect(await screen.findByRole("alert")).toHaveTextContent("Access denied")
  expect(screen.queryByText("No quotations found")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  expect(await screen.findByText("No quotations found")).toBeInTheDocument()
})

it("does not expose old rows while another lead is loading or accept stale responses", async () => {
  let resolveOld: (value: LeadCommerceResult) => void = () => undefined
  jest.mocked(getLeadCommerce).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  const { rerender } = render(<CommerceView leadId="lead-a" />)
  rerender(<CommerceView leadId="lead-b" />)
  expect(await screen.findByRole("link", { name: "Quote A" })).toBeInTheDocument()
  await act(async () => resolveOld({ rows: [{ ...row, title: "Stale quote" }], count: 1 }))
  expect(screen.queryByText("Stale quote")).not.toBeInTheDocument()
  siteId = "site-b"
  jest.mocked(getLeadCommerce).mockImplementationOnce(() => new Promise(() => undefined))
  rerender(<CommerceView leadId="lead-b" />)
  expect(screen.queryByText("Quote A")).not.toBeInTheDocument()
  expect(screen.getByRole("status")).toBeInTheDocument()
})

it("refreshes only on this lead's payment event and removes its listener", async () => {
  const { unmount } = render(<CommerceView leadId="lead-a" />)
  await screen.findByText("Quote A")
  act(() => window.dispatchEvent(new CustomEvent("lead:invoice-payment-recorded", { detail: { siteId, leadId: "other" } })))
  expect(getLeadCommerce).toHaveBeenCalledTimes(1)
  act(() => window.dispatchEvent(new CustomEvent("lead:invoice-payment-recorded", { detail: { siteId, leadId: "lead-a" } })))
  await waitFor(() => expect(getLeadCommerce).toHaveBeenCalledTimes(2))
  unmount()
  act(() => window.dispatchEvent(new CustomEvent("lead:invoice-payment-recorded", { detail: { siteId, leadId: "lead-a" } })))
  expect(getLeadCommerce).toHaveBeenCalledTimes(2)
})