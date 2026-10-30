import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { SupplierInfo } from "@/app/suppliers/components/supplier-info"
import { emptySupplier } from "@/app/suppliers/schema"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key, locale: "en" }) }))
jest.mock("@/app/suppliers/components/reference-picker", () => ({ SupplierReferencePicker: () => <span>Reference picker</span> }))

function Harness({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState({ ...emptySupplier, expected_version: 3, name: "Supplier A", private_notes: "Original notes",
    contacts: [{ name: "Person A", email: "a@example.test", phone: "", role: "Sales", is_primary: true }] })
  return <form aria-label="Supplier edit" onSubmit={event => event.preventDefault()}>
    <SupplierInfo siteId="site" value={value} onChange={setValue} disabled={disabled} />
    <output>{JSON.stringify(value)}</output>
  </form>
}
function tab(name: string) { fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false }) }

it("matches lead tab styling and keeps inline draft edits across tabs without submitting", async () => {
  render(<Harness />)
  expect(screen.getByRole("tablist")).toHaveClass("rounded-full", "h-8", "bg-muted/30", "overflow-x-auto")
  expect(screen.getAllByRole("tab").map(item => item.textContent)).toEqual(["Info", "Company", "Contacts", "Notes"])
  fireEvent.click(screen.getByText("Supplier A", { selector: "div" }))
  expect(screen.getByRole("textbox", { name: "Supplier name" })).toHaveClass("h-8", "text-sm")
  fireEvent.change(screen.getByRole("textbox", { name: "Supplier name" }), { target: { value: "Renamed" } })
  expect(screen.getByRole("button", { name: "Save supplier name" })).toHaveAttribute("type", "button")
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save supplier name" })))
  tab("Notes")
  fireEvent.click(screen.getByText("Original notes", { selector: "div" }))
  fireEvent.change(screen.getByRole("textbox", { name: "Private workspace notes" }), { target: { value: "Revised notes" } })
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save private workspace notes" })))
  tab("Contacts")
  fireEvent.click(within(screen.getByRole("region", { name: "Contact 1" })).getByText("Person A"))
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Person B" } })
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save name" })))
  tab("Info")
  expect(screen.getByText("Renamed", { selector: "div" })).toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent('"private_notes":"Revised notes"')
  expect(screen.getByRole("status")).toHaveTextContent('"name":"Person B"')
})

it("cancels a field edit and does not expose editors for read-only members", () => {
  const { unmount } = render(<Harness />)
  fireEvent.click(screen.getByText("Supplier A", { selector: "div" }))
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Discard" } })
  fireEvent.click(screen.getByRole("button", { name: "Cancel supplier name edit" }))
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  expect(screen.getByText("Supplier A", { selector: "div" })).toBeInTheDocument()
  unmount()
  render(<Harness disabled />)
  fireEvent.click(screen.getByText("Supplier A", { selector: "div" }))
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  tab("Contacts")
  fireEvent.click(screen.getByText("Person A", { selector: "div" }))
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
})