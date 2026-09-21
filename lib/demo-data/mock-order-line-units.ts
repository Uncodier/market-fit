type DemoData = Record<string, any[]>

function nextStatus(status: string) {
  if (["draft", "new", "pending"].includes(status)) return "preparing"
  if (["preparing", "in_progress"].includes(status)) return "completed"
  if (["completed", "ready"].includes(status)) return "returned"
  return null
}

function updateMilestones(
  unit: Record<string, any>,
  status: string,
  updatedAt: string,
) {
  if (["draft", "new", "pending"].includes(status)) {
    unit.in_progress_at = null
    unit.ready_at = null
    unit.completed_at = null
    unit.delivered_at = null
  } else if (["preparing", "in_progress"].includes(status)) {
    unit.in_progress_at ||= updatedAt
    unit.ready_at = null
    unit.completed_at = null
    unit.delivered_at = null
  } else if (["completed", "ready", "returned"].includes(status)) {
    unit.in_progress_at ||= unit.started_at
    unit.ready_at ||= updatedAt
    unit.completed_at = unit.ready_at
  }
}

function syncParentStatuses(
  memoryData: DemoData,
  selected: Array<Record<string, any>>,
) {
  const units = memoryData.sale_order_item_units || []
  for (const itemId of new Set(
    selected.map((unit) => unit.sale_order_item_id),
  )) {
    const statuses = new Set(
      units
        .filter((unit) => unit.sale_order_item_id === itemId)
        .map((unit) => unit.status),
    )
    if (statuses.size !== 1) continue
    const item = (memoryData.sale_order_items || []).find(
      (line) => line.id === itemId,
    )
    if (item) item.status = [...statuses][0]
  }
}

export function mutateDemoOrderLineUnits(
  memoryData: DemoData,
  params: Record<string, any>,
) {
  const ids = [...new Set((params?.p_unit_ids || []).filter(Boolean))]
  const units = memoryData.sale_order_item_units || []
  const selected = units.filter(
    (unit) =>
      unit.site_id === params?.p_site_id && ids.includes(unit.id),
  )
  if (selected.length !== ids.length) {
    return {
      data: null,
      error: { message: "One or more order-line units were not found" },
    }
  }

  if (params?.p_operation === "assign" && params.p_assignee_id) {
    const validAssignee =
      (memoryData.sites || []).some(
        (site) =>
          site.id === params.p_site_id &&
          site.user_id === params.p_assignee_id,
      ) ||
      (memoryData.site_members || []).some(
        (member) =>
          member.site_id === params.p_site_id &&
          member.user_id === params.p_assignee_id &&
          member.status !== "rejected",
      )
    if (!validAssignee) {
      return {
        data: null,
        error: { message: "Assignee must be an active site member" },
      }
    }
  }

  if (
    params?.p_operation === "set_status" &&
    selected.some((unit) => nextStatus(unit.status) !== params.p_status)
  ) {
    return {
      data: null,
      error: {
        message: "Order-line units can only move to their next status",
      },
    }
  }
  let transitions: Record<string, string> = {}
  if (params?.p_operation === "advance") {
    try {
      transitions = JSON.parse(params.p_status || "{}")
    } catch {
      return {
        data: null,
        error: { message: "Expected transitions are required" },
      }
    }
    if (
      selected.some(
        (unit) => transitions[unit.id] !== nextStatus(unit.status),
      )
    ) {
      return {
        data: null,
        error: { message: "Order-line units changed before this update" },
      }
    }
  }

  let updatedCount = 0
  const updatedAt = new Date().toISOString()
  for (const unit of selected) {
    let status = unit.status
    let updated = false
    if (params?.p_operation === "advance") {
      status = transitions[unit.id]
      updated = true
    } else if (params?.p_operation === "set_status") {
      status = params.p_status
      updated = true
    } else if (
      params?.p_operation === "cancel" &&
      !["cancelled", "returned"].includes(unit.status)
    ) {
      status = "cancelled"
      updated = true
    } else if (params?.p_operation === "assign") {
      unit.assigned_to = params.p_assignee_id || null
      updated = true
    }

    if (status !== unit.status) {
      unit.status = status
      updateMilestones(unit, status, updatedAt)
    }
    if (updated) {
      unit.updated_at = updatedAt
      updatedCount += 1
    }
  }
  syncParentStatuses(memoryData, selected)
  return { data: updatedCount, error: null }
}

export function syncDemoUnitsFromOrderItems(
  memoryData: DemoData,
  items: Array<Record<string, any>>,
  changes: Record<string, any>,
) {
  const updatedAt = new Date().toISOString()
  let units = memoryData.sale_order_item_units || []
  for (const item of items) {
    const numericQuantity = Number(item.quantity)
    const count =
      Number.isInteger(numericQuantity) && numericQuantity > 0
        ? numericQuantity
        : numericQuantity > 0
          ? 1
          : 0
    if (item.parent_sale_order_item_id || item.metadata?.is_modifier || !count) {
      units = units.filter((unit) => unit.sale_order_item_id !== item.id)
      continue
    }

    units = units.filter(
      (unit) =>
        unit.sale_order_item_id !== item.id || unit.unit_index <= count,
    )
    for (let index = 1; index <= count; index += 1) {
      let unit = units.find(
        (candidate) =>
          candidate.sale_order_item_id === item.id &&
          candidate.unit_index === index,
      )
      if (!unit) {
        unit = {
          id: `${item.id}-unit-${index}`,
          site_id: item.site_id,
          sale_order_item_id: item.id,
          unit_index: index,
          quantity: count === 1 ? numericQuantity : 1,
          status: item.status || "draft",
          assigned_to: null,
          shipment_id: item.shipment_id || null,
          started_at: item.sent_at || item.created_at || updatedAt,
          created_at: item.created_at || updatedAt,
          updated_at: updatedAt,
        }
        updateMilestones(unit, unit.status, updatedAt)
        units.push(unit)
      }
      unit.site_id = item.site_id
      unit.quantity = count === 1 ? numericQuantity : 1
      if ("shipment_id" in changes) {
        unit.shipment_id = item.shipment_id || null
        const shipment = (memoryData.shipments || []).find(
          (candidate) => candidate.id === unit.shipment_id,
        )
        unit.delivered_at = shipment?.delivered_at || null
      }
      if ("sent_at" in changes) {
        unit.started_at = item.sent_at || unit.started_at
      }
      if (typeof changes.status === "string") {
        unit.status = changes.status
        updateMilestones(unit, changes.status, updatedAt)
      }
      unit.updated_at = updatedAt
    }
  }
  memoryData.sale_order_item_units = units
}

export function cascadeDeleteDemoOrderItems(
  memoryData: DemoData,
  removedItems: Array<Record<string, any>>,
) {
  const ids = new Set(removedItems.map((item) => item.id))
  const clientKeys = new Set(
    removedItems
      .map((item) => item.metadata?.client_line_key)
      .filter(Boolean),
  )
  let foundChild = true
  while (foundChild) {
    foundChild = false
    for (const item of memoryData.sale_order_items || []) {
      if (
        ids.has(item.id) ||
        (!ids.has(item.parent_sale_order_item_id) &&
          !clientKeys.has(item.metadata?.parent_client_line_key))
      ) {
        continue
      }
      ids.add(item.id)
      if (item.metadata?.client_line_key) {
        clientKeys.add(item.metadata.client_line_key)
      }
      foundChild = true
    }
  }
  memoryData.sale_order_items = (
    memoryData.sale_order_items || []
  ).filter((item) => !ids.has(item.id))
  memoryData.sale_order_item_units = (
    memoryData.sale_order_item_units || []
  ).filter((unit) => !ids.has(unit.sale_order_item_id))
}

export function syncDemoUnitDelivery(
  memoryData: DemoData,
  shipments: Array<Record<string, any>>,
) {
  const deliveredAtByShipment = new Map(
    shipments.map((shipment) => [
      shipment.id,
      shipment.status === "delivered"
        ? shipment.delivered_at || new Date().toISOString()
        : shipment.delivered_at || null,
    ]),
  )
  for (const unit of memoryData.sale_order_item_units || []) {
    if (!deliveredAtByShipment.has(unit.shipment_id)) continue
    unit.delivered_at = deliveredAtByShipment.get(unit.shipment_id)
  }
}
