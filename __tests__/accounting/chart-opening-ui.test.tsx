import { accounts, entry, mockSite, deferred } from "./ui-fixtures"
import React from "react"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { ChartOfAccountsClient } from "@/app/accounting/components/ChartOfAccountsClient"
import { OpeningBalancesDialog } from "@/app/accounting/components/OpeningBalancesDialog"
import { addAccountingAccount, ensureChartOfAccounts, getAllAccounts, getOpeningEntry, saveOpeningEntry } from "@/app/accounting/chart"

jest.mock("@/app/accounting/chart", () => ({
  addAccountingAccount: jest.fn(), updateAccountLabel: jest.fn(), toggleAccountActive: jest.fn(),
  ensureChartOfAccounts: jest.fn(), getAllAccounts: jest.fn(), getOpeningEntry: jest.fn(), saveOpeningEntry: jest.fn(),
}))

beforeEach(() => {
  jest.mocked(getAllAccounts).mockResolvedValue(accounts)
  jest.mocked(getOpeningEntry).mockResolvedValue(null)
})

async function openBalances() {
  const button = screen.getByRole("button", { name: "Opening Balances" })
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
  return screen.getByRole("dialog")
}

it("blocks opening via button and global event until both accounts and opening entry load", async () => {
  const pending = deferred<ReturnType<typeof entry> | null>()
  jest.mocked(getOpeningEntry).mockReturnValueOnce(pending.promise)
  render(<ChartOfAccountsClient />)
  expect(screen.getByRole("button", { name: "Opening Balances" })).toBeDisabled()
  await act(async () => { window.dispatchEvent(new CustomEvent("accounting:openingBalances")) })
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(saveOpeningEntry).not.toHaveBeenCalled()
  await act(async () => { pending.resolve(null) })
  expect(screen.getByRole("button", { name: "Opening Balances" })).toBeEnabled()
  expect(ensureChartOfAccounts).not.toHaveBeenCalled()
})

it("fails closed on load errors and allows an explicit retry", async () => {
  jest.mocked(getOpeningEntry).mockRejectedValueOnce(new Error("Opening data unavailable"))
  render(<ChartOfAccountsClient />)
  expect(await screen.findByRole("alert")).toHaveTextContent("Opening data unavailable")
  expect(screen.getByRole("button", { name: "Opening Balances" })).toBeDisabled()
  act(() => { window.dispatchEvent(new CustomEvent("accounting:openingBalances")) })
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Retry loading accounts" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "Opening Balances" })).toBeEnabled())
})

it("ignores stale site loads and resets dates, balances, currency, and hash for a new site", async () => {
  const stale = deferred<ReturnType<typeof entry> | null>()
  jest.mocked(getOpeningEntry).mockReturnValueOnce(stale.promise)
  const view = render(<ChartOfAccountsClient />)
  mockSite.current = { id: "site-b", settings: { currency: "GBP" } }
  view.rerender(<ChartOfAccountsClient />)
  const dialog = await openBalances()
  await act(async () => { stale.resolve(entry({ source_type: "opening" })) })
  expect(within(dialog).getByText("Currency: GBP")).toBeInTheDocument()
  expect(within(dialog).getByLabelText("1000 debit")).toHaveValue(null)
  expect(within(dialog).queryByLabelText("6100 debit")).not.toBeInTheDocument()
  fireEvent.change(within(dialog).getByLabelText("1000 debit"), { target: { value: "12.34" } })
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))
  await waitFor(() => expect(saveOpeningEntry).toHaveBeenCalledWith("site-b", expect.any(String), {
    "1000": { debit: 12.34, credit: 0 }, "3000": { debit: 0, credit: 12.34 },
  }, "GBP", null))
})

it("closes and clears an already edited opening when switching sites", async () => {
  jest.mocked(getOpeningEntry).mockResolvedValueOnce(entry({ source_type: "opening" }))
  const view = render(<ChartOfAccountsClient />)
  const dialog = await openBalances()
  fireEvent.change(within(dialog).getByLabelText("1000 debit"), { target: { value: "99" } })
  const pending = deferred<null>()
  jest.mocked(getOpeningEntry).mockReturnValueOnce(pending.promise)
  mockSite.current = { id: "site-b", settings: { currency: "GBP" } }
  view.rerender(<ChartOfAccountsClient />)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Opening Balances" })).toBeDisabled()
  await act(async () => { pending.resolve(null) })
  const next = await openBalances()
  expect(within(next).getByLabelText("1000 debit")).toHaveValue(null)
  expect(within(next).getByRole("button", { name: "Save" })).toBeDisabled()
})

it("preserves opening currency/hash, displays inactive existing accounts, and shows automatic equity read-only", async () => {
  jest.mocked(getOpeningEntry).mockResolvedValueOnce(entry({
    source_type: "opening", journal_lines: [
      { id: "a", account_code: "6100", debit: 50, credit: 0 },
      { id: "b", account_code: "3000", debit: 0, credit: 50 },
    ],
  }))
  render(<ChartOfAccountsClient />)
  const dialog = await openBalances()
  expect(within(dialog).getByText("Currency: EUR")).toBeInTheDocument()
  expect(within(dialog).getByLabelText("6100 debit")).toHaveValue(50)
  expect(within(dialog).getByLabelText("3000 credit")).toHaveAttribute("readonly")
  fireEvent.change(within(dialog).getByLabelText("3000 credit"), { target: { value: "999" } })
  expect(within(dialog).getByLabelText("3000 credit")).toHaveValue(50)
  fireEvent.change(within(dialog).getByLabelText("6100 debit"), { target: { value: "75" } })
  expect(within(dialog).getByLabelText("3000 credit")).toHaveValue(75)
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))
  await waitFor(() => expect(saveOpeningEntry).toHaveBeenCalledWith("site-a", "2026-09-01", {
    "6100": { debit: 75, credit: 0 }, "3000": { debit: 0, credit: 75 },
  }, "EUR", "loaded-hash"))
})

it("clear only edits the ready draft and does not save empty or invalid amounts", async () => {
  render(<ChartOfAccountsClient />)
  const dialog = await openBalances()
  fireEvent.change(within(dialog).getByLabelText("1000 debit"), { target: { value: "1.001" } })
  expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled()
  fireEvent.change(within(dialog).getByLabelText("1000 debit"), { target: { value: "10" } })
  expect(within(dialog).getByRole("button", { name: "Save" })).toBeEnabled()
  fireEvent.click(within(dialog).getByRole("button", { name: "Clear amounts" }))
  expect(within(dialog).getByLabelText("1000 debit")).toHaveValue(null)
  expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled()
  fireEvent.submit(dialog.querySelector("form")!)
  expect(saveOpeningEntry).not.toHaveBeenCalled()
})

it("cannot save a stale form after readiness is lost", () => {
  const props = { siteId: "site-a", accounts, opening: { date: "2026-09-01", balances: { "1000": { debit: 10, credit: 0 } }, currency: "EUR", expectedHash: "hash" }, open: true, onOpenChange: jest.fn(), onSaved: jest.fn() }
  const view = render(<OpeningBalancesDialog {...props} ready />)
  view.rerender(<OpeningBalancesDialog {...props} ready={false} />)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(saveOpeningEntry).not.toHaveBeenCalled()
})

it("initializes an empty chart only through an explicit action", async () => {
  jest.mocked(getAllAccounts).mockResolvedValueOnce([])
  render(<ChartOfAccountsClient />)
  const button = await screen.findByRole("button", { name: "Initialize chart of accounts" })
  expect(screen.getByRole("button", { name: "Opening Balances" })).toBeDisabled()
  expect(ensureChartOfAccounts).not.toHaveBeenCalled()
  fireEvent.click(button)
  await waitFor(() => expect(ensureChartOfAccounts).toHaveBeenCalledWith("site-a"))
  await waitFor(() => expect(screen.getByRole("button", { name: "Opening Balances" })).toBeEnabled())
})

it.each(["Asset", "Liability", "Equity", "Income", "Expense"])("creates a custom %s account using the general API", async (type) => {
  jest.mocked(addAccountingAccount).mockResolvedValueOnce(accounts[0])
  render(<ChartOfAccountsClient />)
  await waitFor(() => expect(screen.getByRole("button", { name: "Opening Balances" })).toBeEnabled())
  act(() => { window.dispatchEvent(new CustomEvent("accounting:create")) })
  const dialog = screen.getByRole("dialog")
  fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Custom Account" } })
  fireEvent.change(within(dialog).getByLabelText("Code"), { target: { value: "1200" } })
  fireEvent.change(within(dialog).getByLabelText("Unique Key"), { target: { value: "CUSTOM" } })
  fireEvent.keyDown(within(dialog).getByLabelText("Type"), { key: "ArrowDown" })
  fireEvent.click(screen.getByRole("option", { name: type }))
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }))
  await waitFor(() => expect(addAccountingAccount).toHaveBeenCalledWith("site-a", "Custom Account", "CUSTOM", "1200", type.toLowerCase()))
})