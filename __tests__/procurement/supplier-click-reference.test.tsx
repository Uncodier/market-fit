import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { SupplierReferenceProperty } from "@/app/suppliers/components/supplier-reference-property"
import { SupplierInfo } from "@/app/suppliers/components/supplier-info"
import { emptySupplier } from "@/app/suppliers/schema"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key, locale: "en" }) }))

function Reference({ disabled = false }: { disabled?: boolean }) {
  const [ids, setIds] = useState(["demo-category-workplace"])
  return <><SupplierReferenceProperty siteId="demo-ecom-es-456" kind="categories" selected={ids} onChange={setIds} disabled={disabled} /><output>{ids.join(',')}</output></>
}

it("only opens category selection on click and allows cancelling and applying changes", async () => {
  render(<Reference />)
  await screen.findByText("Workplace technology")
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  fireEvent.click(await screen.findByText("Workplace technology"))
  const remove = await screen.findByRole("button", { name: "Remove Workplace technology" })
  fireEvent.click(remove)
  expect(screen.getByRole("status")).toHaveTextContent("demo-category-workplace")
  fireEvent.click(screen.getByRole("button", { name: "Cancel supplier categories edit" }))
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  fireEvent.click(await screen.findByText("Workplace technology"))
  fireEvent.click(await screen.findByRole("button", { name: "Remove Workplace technology" }))
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save supplier categories" })))
  expect(screen.getByRole("status")).toBeEmptyDOMElement()
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
})

it("does not open category controls for read-only users", async () => {
  render(<Reference disabled />)
  fireEvent.click(await screen.findByText("Workplace technology"))
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument()
})

it("edits the primary-contact flag on click rather than showing a permanent checkbox", async () => {
  render(<SupplierInfo siteId="demo-ecom-es-456" value={{ ...emptySupplier, name: "Supplier", contacts: [{ name: "Person", email: "", phone: "", role: "", is_primary: true }] }} onChange={jest.fn()} disabled={false} />)
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Contacts" }), { button: 0, ctrlKey: false })
  const contact = screen.getByRole("region", { name: "Contact 1" })
  expect(within(contact).queryByRole("checkbox")).not.toBeInTheDocument()
  fireEvent.click(within(contact).getByText("Yes"))
  expect(within(contact).getByRole("checkbox")).toBeChecked()
  fireEvent.click(within(contact).getByRole("button", { name: "Cancel primary edit" }))
  expect(within(contact).queryByRole("checkbox")).not.toBeInTheDocument()
  await act(async () => {})
})