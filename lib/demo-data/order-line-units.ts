function unitCount(quantity: unknown): number {
  const parsed = Number(quantity)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Number.isInteger(parsed) ? parsed : 1
}

export function attachDemoOrderLineUnits(data: Record<string, any>) {
  if (Array.isArray(data.sale_order_item_units)) return data

  const units = (data.sale_order_items || []).flatMap(
    (line: Record<string, any>) => {
      if (line.parent_sale_order_item_id || line.metadata?.is_modifier) return []
      const count = unitCount(line.quantity)
      const startedAt = line.sent_at || line.created_at
      const inProgressAt = [
        "preparing",
        "in_progress",
        "completed",
        "ready",
        "returned",
      ].includes(line.status)
        ? startedAt
        : null
      const readyAt = ["completed", "ready", "returned"].includes(line.status)
        ? line.updated_at || line.created_at
        : null
      const shipment = (data.shipments || []).find(
        (candidate: Record<string, any>) =>
          candidate.id === line.shipment_id,
      )
      return Array.from({ length: count }, (_, index) => ({
        id: `${line.id}-unit-${index + 1}`,
        site_id: line.site_id,
        sale_order_item_id: line.id,
        unit_index: index + 1,
        quantity: count === 1 ? Number(line.quantity) || 1 : 1,
        status: line.status || "draft",
        assigned_to: null,
        shipment_id: line.shipment_id || null,
        started_at: startedAt,
        in_progress_at: inProgressAt,
        ready_at: readyAt,
        completed_at: readyAt,
        delivered_at: shipment?.delivered_at || null,
        created_at: line.created_at,
        updated_at: line.updated_at || line.created_at,
      }))
    },
  )

  return { ...data, sale_order_item_units: units }
}
