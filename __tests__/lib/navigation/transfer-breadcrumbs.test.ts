import { getSection, reduceBreadcrumb } from "@/lib/navigation/breadcrumb-engine"
import { workspaceScreenRoot } from "@/lib/navigation/workspace-screen"

it("keeps the exact ledger screen separate from transfer detail ownership", () => {
  expect(workspaceScreenRoot("/inventory/movements")).toBe("/inventory/movements")
  expect(getSection("/inventory/movements/transfer-1?demo=1")).toBe("/inventory/transfers")
})
it("uses Inventory Transfers as the parent even when opening a detail from the ledger", () => {
  const ledger = reduceBreadcrumb([], { type: "navigate", path: "/inventory/movements", label: "Inventory Ledger", timestamp: 100 })
  const detail = reduceBreadcrumb(ledger, { type: "navigate", path: "/inventory/movements/transfer-1", label: "Transfer 1", timestamp: 200 })
  expect(detail.map(item => ({ path: item.path, label: item.label }))).toEqual([
    { path: "/inventory/transfers", label: "Inventory Transfers" },
    { path: "/inventory/movements/transfer-1", label: "Transfer 1" },
  ])
})