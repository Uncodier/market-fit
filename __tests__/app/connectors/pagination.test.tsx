import { fireEvent, render, screen } from "@testing-library/react"
import { ConnectorPagination } from "@/app/connectors/connector-pagination"
import { translate } from "./fixtures"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))

test("standard pagination supports first, previous, page numbers, next and last", () => {
  const change = jest.fn()
  render(<ConnectorPagination page={3} totalPages={10} hasNext onPageChange={change} />)
  for (const [label, page] of [["First page", 1], ["Previous", 2], ["5", 5], ["Next", 4], ["Last page", 10]] as const) {
    fireEvent.click(screen.getByRole("button", { name: label }))
    expect(change).toHaveBeenLastCalledWith(page)
  }
  expect(screen.getByRole("button", { name: "3" })).toHaveAttribute("aria-current", "page")
})

test("boundaries disable navigation and unknown totals never invent a last page", () => {
  const change = jest.fn()
  const view = render(<ConnectorPagination page={1} totalPages={4} hasNext onPageChange={change} />)
  expect(screen.getByRole("button", { name: "First page" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled()
  view.rerender(<ConnectorPagination page={4} totalPages={4} hasNext={false} onPageChange={change} />)
  expect(screen.getByRole("button", { name: "Last page" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
  view.rerender(<ConnectorPagination page={2} totalPages={null} hasNext onPageChange={change} />)
  expect(screen.getByRole("button", { name: "Last page" })).toBeDisabled()
})