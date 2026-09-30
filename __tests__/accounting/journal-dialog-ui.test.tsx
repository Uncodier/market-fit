import { accounts, entry, mockSite, deferred } from "./ui-fixtures"
import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { JournalEntryDialog } from "@/app/accounting/components/JournalEntryDialog"
import { createManualJournalEntry, updateManualJournalEntry } from "@/app/accounting/entries"

jest.mock("@/app/accounting/entries", () => ({ createManualJournalEntry: jest.fn(), updateManualJournalEntry: jest.fn() }))

function renderEntry(value: ReturnType<typeof entry> | null = entry()) {
  const onSaved = jest.fn()
  const onOpenChange = jest.fn()
  const props = { open: true, entry: value, accounts, onSaved, onOpenChange }
  return { ...render(<JournalEntryDialog {...props} />), props, onSaved, onOpenChange }
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Save Entry" }))
}

it("removes a line without submitting an otherwise valid entry", () => {
  const value = entry({ journal_lines: [...entry().journal_lines, { id: "empty", account_code: "", debit: 0, credit: 0 }] })
  renderEntry(value)
  expect(screen.getByRole("button", { name: "Save Entry" })).toBeEnabled()
  const remove = screen.getByRole("button", { name: "Remove line 3" })
  expect(remove).toHaveAttribute("type", "button")
  fireEvent.click(remove)
  expect(screen.getAllByRole("combobox")).toHaveLength(2)
  expect(updateManualJournalEntry).not.toHaveBeenCalled()
  expect(createManualJournalEntry).not.toHaveBeenCalled()
})

it("preserves the edited currency and source hash, displays matching money, and strips unused lines", async () => {
  renderEntry(entry({ journal_lines: [...entry().journal_lines, { id: "empty", account_code: "", debit: 0, credit: 0 }] }))
  expect(screen.getByText("EUR")).toBeInTheDocument()
  expect(screen.getAllByText("€10.00")).toHaveLength(2)
  submit()
  await waitFor(() => expect(updateManualJournalEntry).toHaveBeenCalledWith("site-a", "entry-a", {
    entryDate: "2026-09-01", memo: "Opening adjustment", currency: "EUR", expectedHash: "loaded-hash",
    lines: [{ accountCode: "1000", debit: 10, credit: 0 }, { accountCode: "2000", debit: 0, credit: 10 }],
  }))
})

it("uses the site currency for new entries and refuses an empty draft", () => {
  mockSite.current.settings.currency = "CAD"
  renderEntry(null)
  expect(screen.getByText("CAD")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Save Entry" })).toBeDisabled()
  fireEvent.submit(screen.getByRole("dialog").querySelector("form")!)
  expect(createManualJournalEntry).not.toHaveBeenCalled()
})

it("hides inactive accounts from new selections but displays existing inactive accounts", () => {
  const { rerender, props } = renderEntry(null)
  fireEvent.keyDown(screen.getByLabelText("Account for line 1"), { key: "ArrowDown" })
  expect(screen.getByRole("option", { name: /Cash/ })).toBeInTheDocument()
  expect(screen.queryByRole("option", { name: /Legacy Expense/ })).not.toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" })
  rerender(<JournalEntryDialog {...props} entry={entry({ journal_lines: [{ id: "line-a", account_code: "6100", debit: 10, credit: 0 }, entry().journal_lines[1]] })} />)
  expect(screen.getByLabelText("Account for line 1")).toHaveTextContent("Legacy Expense (Inactive)")
  expect(screen.getByRole("button", { name: "Save Entry" })).toBeEnabled()
  fireEvent.keyDown(screen.getByLabelText("Account for line 1"), { key: "ArrowDown" })
  expect(screen.getByRole("option", { name: /Legacy Expense/ })).toHaveAttribute("aria-disabled", "true")
})

it.each(["0", "-1", "0.001", "1.001", "10000000000000000"])("rejects invalid or nonpositive balanced amounts: %s", (amount) => {
  renderEntry()
  fireEvent.change(screen.getByLabelText("Debit for line 1"), { target: { value: amount } })
  fireEvent.change(screen.getByLabelText("Credit for line 2"), { target: { value: amount } })
  expect(screen.getByRole("button", { name: "Save Entry" })).toBeDisabled()
  fireEvent.submit(screen.getByRole("dialog").querySelector("form")!)
  expect(updateManualJournalEntry).not.toHaveBeenCalled()
})

it("requires memo and exact integer-cent balance while allowing 0.1 + 0.2 = 0.3", async () => {
  const value = entry({ journal_lines: [
    { id: "line-a", account_code: "1000", debit: 0.1, credit: 0 },
    { id: "line-b", account_code: "1000", debit: 0.2, credit: 0 },
    { id: "line-c", account_code: "2000", debit: 0, credit: 0.3 },
  ] })
  renderEntry(value)
  expect(screen.getByRole("button", { name: "Save Entry" })).toBeEnabled()
  fireEvent.change(screen.getByLabelText("Memo"), { target: { value: "  " } })
  expect(screen.getByRole("button", { name: "Save Entry" })).toBeDisabled()
  fireEvent.change(screen.getByLabelText("Memo"), { target: { value: "Exact cents" } })
  fireEvent.change(screen.getByLabelText("Credit for line 3"), { target: { value: "0.29" } })
  expect(screen.getByRole("button", { name: "Save Entry" })).toBeDisabled()
  fireEvent.change(screen.getByLabelText("Credit for line 3"), { target: { value: "0.3" } })
  submit()
  await waitFor(() => expect(updateManualJournalEntry).toHaveBeenCalledTimes(1))
})

it("does not submit when opening the date picker or adding a line", () => {
  renderEntry()
  fireEvent.click(screen.getByRole("button", { name: "Add Line" }))
  fireEvent.click(screen.getByRole("button", { name: /Sep.*1.*2026/ }))
  expect(updateManualJournalEntry).not.toHaveBeenCalled()
})

it("ignores save completion callbacks after a site switch", async () => {
  const pending = deferred<void>()
  jest.mocked(updateManualJournalEntry).mockReturnValueOnce(pending.promise as never)
  const view = renderEntry()
  submit()
  mockSite.current = { id: "site-b", settings: { currency: "GBP" } }
  view.rerender(<JournalEntryDialog {...view.props} entry={null} />)
  await act(async () => { pending.resolve() })
  expect(view.onSaved).not.toHaveBeenCalled()
  expect(view.onOpenChange).not.toHaveBeenCalled()
  expect(screen.getByText("GBP")).toBeInTheDocument()
})