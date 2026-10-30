import { fireEvent, render, screen, within } from "@testing-library/react"
import { SupplierStatusWidget } from "@/app/suppliers/components/supplier-status-widget"
import { SupplierReferencePicker } from "@/app/suppliers/components/reference-picker"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key, locale: "en" }) }))

it("shows the full supplier lifecycle and applies status changes without bypassing archive confirmation", () => {
  const onChange = jest.fn()
  const onArchive = jest.fn()
  render(<SupplierStatusWidget status="prospect" disabled={false} onChange={onChange} onArchive={onArchive} />)
  const widget = screen.getByRole("group", { name: "Supplier status" })
  for (const name of ["Prospect", "Under review", "Approved", "Blocked", "Archived"]) expect(within(widget).getAllByText(name).length).toBeGreaterThan(0)
  fireEvent.click(within(widget).getByText("Approved"))
  expect(onChange).toHaveBeenCalledWith("approved")
  fireEvent.click(within(widget).getByText("Archived"))
  expect(onArchive).toHaveBeenCalledTimes(1)
  expect(onChange).not.toHaveBeenCalledWith("archived")
})

it.each([true, false])("does not allow read-only or archived supplier transitions (read-only: %s)", disabled => {
  const onChange = jest.fn()
  const onArchive = jest.fn()
  render(<SupplierStatusWidget status={disabled ? "prospect" : "archived"} disabled={disabled} onChange={onChange} onArchive={onArchive} />)
  fireEvent.click(screen.getByText("Approved"))
  expect(onChange).not.toHaveBeenCalled()
  expect(onArchive).not.toHaveBeenCalled()
})

it("aligns compact categories without hidden-label spacing or a nested input border", async () => {
  render(<SupplierReferencePicker siteId="demo-ecom-es-456" kind="categories" selected={[]} compact onChange={jest.fn()} />)
  const input = screen.getByLabelText("Supplier categories")
  expect(input).toHaveClass("h-7", "px-0", "border-0", "bg-transparent")
  expect(input.closest("section")).toHaveClass("[&>div]:space-y-0")
  await screen.findByLabelText("Supplier categories")
})