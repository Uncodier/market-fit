import { render, screen } from "@testing-library/react"
import { MovementsTable } from "@/app/inventory/movements/components/MovementsTable"
import { demoMovements } from "@/app/inventory/movements/demo-data"
import type { InventoryMovement } from "@/app/inventory/movements/types"

test("ledger lifecycle entries show effective signed quantities and link their transfer document", () => {
  const rows: InventoryMovement[] = ["dispatch", "receive", "return", "writeoff"].map((kind, index) => ({
    ...demoMovements[0], id: `event-${index}`, kind: kind as InventoryMovement["kind"], quantity: index === 0 || index === 3 ? -2 : 2,
    transfer_order_id: "transfer-one", from_location_id: null, from_location_name: null,
    to_location_name: index === 3 ? "In transit" : "Main Warehouse",
  }))
  render(<MovementsTable rows={rows} page={1} pageSize={50} count={4} onPageChange={() => {}} />)
  for (const label of ["Dispatch", "Transfer receipt", "Return to origin", "Write off"]) expect(screen.getByText(label)).toBeInTheDocument()
  expect(screen.getByRole("columnheader", { name: "Location" })).toBeInTheDocument()
  expect(screen.getAllByText("-2")).toHaveLength(2)
  expect(screen.getByText("In transit")).toBeInTheDocument()
  expect(screen.getAllByRole("link", { name: /Coffee Beans/ })).toHaveLength(4)
  expect(screen.getAllByRole("link", { name: /Coffee Beans/ })[0]).toHaveAttribute("href", "/inventory/movements/transfer-one")
})