import { accounts, entry } from "./ui-fixtures"
import React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { JournalEntriesTable } from "@/app/accounting/components/JournalEntriesTable"

function renderTable(entries = [entry()]) {
  return render(<JournalEntriesTable entries={entries} accounts={accounts} currency="USD" onOpen={jest.fn()} onOpenSource={jest.fn()} onDelete={jest.fn()} />)
}

it.each(["2026-09-01", "2026-09-01T00:00:00+00:00", "2026-09-01T23:59:59Z"])("displays the saved accounting date portion: %s", (entry_date) => {
  renderTable([entry({ entry_date })])
  expect(screen.getByText("Sep 1, 2026")).toBeInTheDocument()
})

it("uses each entry currency for rows, expanded lines, and separate grouped totals", () => {
  renderTable([entry(), entry({ id: "entry-usd", memo: "Dollar adjustment", currency: "USD" })])
  const euroRow = screen.getByText("Opening adjustment").closest("tr")!
  expect(within(euroRow).getAllByText("€10.00")).toHaveLength(2)
  const usdRow = screen.getByText("Dollar adjustment").closest("tr")!
  expect(within(usdRow).getAllByText("$10.00")).toHaveLength(2)
  expect(screen.getByLabelText("EUR totals")).toHaveTextContent(/Debit €10.00\s*Credit €10.00/)
  expect(screen.getByLabelText("USD totals")).toHaveTextContent(/Debit \$10.00\s*Credit \$10.00/)
  expect(screen.queryByText("$20.00")).not.toBeInTheDocument()
  fireEvent.click(within(euroRow).getByRole("button", { name: "Show lines" }))
  expect(screen.getAllByText("€10.00")).toHaveLength(6)
  for (const button of screen.getAllByRole("button")) expect(button).toHaveAttribute("type", "button")
})