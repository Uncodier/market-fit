import { accounts, entry, deferred } from "./ui-fixtures"
import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useChartData } from "@/app/accounting/components/use-chart-data"
import { getAllAccounts, getOpeningEntry, saveOpeningEntry } from "@/app/accounting/chart"
import { ChartOfAccountsClient } from "@/app/accounting/components/ChartOfAccountsClient"

jest.mock("@/app/accounting/chart", () => ({
  getAllAccounts: jest.fn(), getOpeningEntry: jest.fn(), saveOpeningEntry: jest.fn(),
  ensureChartOfAccounts: jest.fn(), addAccountingAccount: jest.fn(), updateAccountLabel: jest.fn(), toggleAccountActive: jest.fn(),
}))

function ReloadableChart() {
  const state = useChartData("site-a", "USD")
  return <div><button type="button" onClick={() => void state.reload()}>Reload</button><output>{state.status}:{state.opening?.currency}:{state.accounts[0]?.label}</output></div>
}

it("ignores an older same-site request after a newer reload has finished", async () => {
  const older = deferred<ReturnType<typeof entry> | null>()
  jest.mocked(getAllAccounts).mockResolvedValueOnce([{ ...accounts[0], label: "Old cash" }]).mockResolvedValueOnce([{ ...accounts[0], label: "Current cash" }])
  jest.mocked(getOpeningEntry).mockReturnValueOnce(older.promise).mockResolvedValueOnce(entry({ currency: "GBP" }))
  render(<ReloadableChart />)
  fireEvent.click(screen.getByRole("button", { name: "Reload" }))
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ready:GBP:Current cash"))
  await act(async () => { older.resolve(entry({ currency: "EUR" })) })
  expect(screen.getByRole("status")).toHaveTextContent("ready:GBP:Current cash")
})

it("ignores an older same-site rejection after a newer success", async () => {
  const older = deferred<ReturnType<typeof entry> | null>()
  jest.mocked(getAllAccounts).mockResolvedValue(accounts)
  jest.mocked(getOpeningEntry).mockReturnValueOnce(older.promise).mockResolvedValueOnce(null)
  render(<ReloadableChart />)
  fireEvent.click(screen.getByRole("button", { name: "Reload" }))
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ready:USD:Cash"))
  await act(async () => { older.reject(new Error("Old request failed")) })
  expect(screen.getByRole("status")).toHaveTextContent("ready:USD:Cash")
})

it("blocks editing when account reads fail even if opening data loaded", async () => {
  jest.mocked(getAllAccounts).mockRejectedValueOnce(new Error("Accounts unavailable"))
  jest.mocked(getOpeningEntry).mockResolvedValueOnce(entry({ source_type: "opening" }))
  render(<ChartOfAccountsClient />)
  expect(await screen.findByRole("alert")).toHaveTextContent("Accounts unavailable")
  act(() => { window.dispatchEvent(new CustomEvent("accounting:openingBalances")) })
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Opening Balances" })).toBeDisabled()
  expect(saveOpeningEntry).not.toHaveBeenCalled()
})