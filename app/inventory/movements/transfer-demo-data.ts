import { demoItems, demoLocations, demoMembers } from "./demo-data"
import type { TransferOrderDetail } from "./order-types"

// Local read-only presentation fixtures; never used by server actions.
export const demoTransferOrders: TransferOrderDetail[] = ["draft", "requested", "approved", "in_transit", "partially_received", "received"].map((status, index) => {
  const from = demoLocations[index % 4], to = demoLocations[(index + 1) % 4]
  const id = `demo-transfer-${index + 1}`
  const date = `2026-11-${String(13 - index).padStart(2, "0")}T10:00:00Z`
  return {
    id, site_id: "demo-site", status: status as TransferOrderDetail["status"],
    from_location_id: from.id, to_location_id: to.id, from_location_name: from.name, to_location_name: to.name,
    requested_by: demoMembers[0].name, receiving_user_id: demoMembers[1].id, receiving_user_name: demoMembers[1].name,
    notes: index === 4 ? "Two mugs damaged during transport. Remaining units are still in transit." : "Weekly replenishment. Check quantities on arrival.",
    revision: index + 1, created_at: date, updated_at: date,
    lines: demoItems.map((item, row) => ({
      id: `${id}-line-${row}`, order_id: id, site_id: "demo-site", catalog_item_id: item.id, item_name: item.name,
      requested_quantity: 20 + row * 10, dispatched_quantity: index >= 3 ? 20 + row * 10 : 0,
      received_quantity: index === 5 ? 20 + row * 10 : index === 4 ? 10 : 0,
      returned_quantity: index === 4 && row === 0 ? 2 : 0,
      written_off_quantity: index === 4 && row === 1 ? 2 : 0,
      discrepancy_notes: index === 4 && row < 2 ? row === 0 ? "Packaging mismatch: 2 returned to origin" : "2 mugs broken in transit" : null,
    })),
    events: [{ id: `${id}-created`, action: "create", actor_id: demoMembers[0].name, created_at: date, payload: { status } }],
  }
})