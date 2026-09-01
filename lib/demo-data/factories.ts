export function isoNow(): string {
  return new Date().toISOString()
}

export function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString()
}

export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString()
}

export function makeCategory(
  id: string,
  siteId: string,
  name: string,
  sortOrder = 0,
  extra: Record<string, unknown> = {}
) {
  const now = isoNow()
  return { id, site_id: siteId, name, description: null, sort_order: sortOrder, created_at: now, updated_at: now, ...extra }
}

export function makeItem(
  id: string,
  siteId: string,
  fields: {
    name: string
    kind: "product" | "service" | "digital_asset"
    category_id?: string | null
    target_sale_price: number
    currency?: string
    [key: string]: unknown
  }
) {
  const now = isoNow()
  const price = fields.target_sale_price
  return {
    id,
    site_id: siteId,
    category_id: fields.category_id ?? null,
    digital_subtype: null,
    description: "",
    image_url: `https://picsum.photos/seed/${id}/400/400`,
    sku: null,
    cost: Math.round(price * 0.4 * 100) / 100,
    lowest_sale_price: price,
    currency: fields.currency || "USD",
    track_inventory: false,
    availability_mode: "always",
    availability_status: "available",
    status: "active",
    sort_order: 0,
    is_pos_available: false,
    is_recurring: false,
    is_reservation: false,
    is_purchasable: true,
    parent_id: null,
    created_at: now,
    updated_at: now,
    ...fields,
  }
}

export function makeLocation(
  id: string,
  siteId: string,
  name: string,
  extra: Record<string, unknown> = {}
) {
  const now = isoNow()
  return {
    id,
    site_id: siteId,
    name,
    code: null,
    is_default: false,
    is_active: true,
    created_at: now,
    updated_at: now,
    ...extra,
  }
}

export function makeInventoryLevel(
  id: string,
  siteId: string,
  catalogItemId: string,
  locationId: string,
  quantity: number
) {
  return {
    id,
    site_id: siteId,
    catalog_item_id: catalogItemId,
    location_id: locationId,
    quantity,
    updated_at: isoNow(),
  }
}

export function makePriceList(
  id: string,
  siteId: string,
  name: string,
  extra: Record<string, unknown> = {}
) {
  const now = isoNow()
  return {
    id,
    site_id: siteId,
    name,
    code: null,
    currency: "USD",
    is_default: false,
    is_active: true,
    channels: ["pos", "shop"],
    created_at: now,
    updated_at: now,
    ...extra,
  }
}

export function makePriceListItem(
  id: string,
  siteId: string,
  priceListId: string,
  catalogItemId: string,
  unitPrice: number
) {
  return {
    id,
    site_id: siteId,
    price_list_id: priceListId,
    catalog_item_id: catalogItemId,
    unit_price: unitPrice,
    updated_at: isoNow(),
  }
}

export function makeTax(id: string, siteId: string, name: string, rate: number) {
  const now = isoNow()
  return { id, site_id: siteId, name, rate, is_active: true, created_at: now, updated_at: now }
}

export function makeCatalogItemTax(id: string, siteId: string, catalogItemId: string, taxId: string) {
  return { id, site_id: siteId, catalog_item_id: catalogItemId, tax_id: taxId, created_at: isoNow() }
}

export function makeRecordCategory(
  id: string,
  siteId: string,
  name: string,
  templateFields: any[],
  extra: Record<string, unknown> = {}
) {
  const now = isoNow()
  return {
    id,
    site_id: siteId,
    name,
    description: null,
    icon: extra.icon ?? null,
    parent_category_id: extra.parent_category_id ?? null,
    template_fields: templateFields,
    created_at: now,
    updated_at: now,
    ...extra,
  }
}

export function makeRecord(
  id: string,
  siteId: string,
  categoryId: string,
  title: string,
  extra: Record<string, unknown> = {}
) {
  const now = isoNow()
  return {
    id,
    site_id: siteId,
    category_id: categoryId,
    title,
    description: extra.description ?? null,
    data: extra.data ?? {},
    relations: extra.relations ?? {},
    status: extra.status ?? "draft",
    created_at: extra.created_at ?? now,
    updated_at: extra.updated_at ?? now,
    ...extra,
  }
}

export function makeLinkedOrder(opts: {
  siteId: string
  prefix: string
  leadId: string
  locationId?: string | null
  status: string
  fulfillment: string
  source?: string
  daysAgo: number
  currency?: string
  items: { catalogItemId: string; name: string; qty: number; unitPrice: number }[]
  paymentStatus?: "paid" | "unpaid"
}) {
  const created = isoDaysAgo(opts.daysAgo)
  const subtotal = opts.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
  const saleId = `sale-${opts.prefix}`
  const orderId = `so-${opts.prefix}`
  const paid = opts.paymentStatus !== "unpaid"
  const currency = opts.currency || "USD"

  return {
    sale: {
      id: saleId,
      site_id: opts.siteId,
      lead_id: opts.leadId,
      amount: subtotal,
      currency,
      status: paid ? "completed" : "pending",
      source: opts.source || "pos",
      payment_method: paid ? "card" : null,
      amount_due: paid ? 0 : subtotal,
      payments: paid ? [{ amount: subtotal, method: "card", paid_at: created }] : [],
      sale_date: created.slice(0, 10),
      created_at: created,
      updated_at: created,
    },
    order: {
      id: orderId,
      site_id: opts.siteId,
      sale_id: saleId,
      order_number: `SO-${opts.prefix.replace(/-/g, "").toUpperCase()}`,
      status: opts.status,
      subtotal,
      tax_total: 0,
      discount_total: 0,
      total: subtotal,
      currency,
      fulfillment_method: opts.fulfillment,
      origin_location_id: opts.locationId || null,
      created_at: created,
      updated_at: created,
    },
    items: opts.items.map((item, index) => ({
      id: `soi-${opts.prefix}-${index}`,
      sale_order_id: orderId,
      site_id: opts.siteId,
      catalog_item_id: item.catalogItemId,
      location_id: opts.locationId || null,
      name: item.name,
      quantity: item.qty,
      unit_price: item.unitPrice,
      subtotal: item.qty * item.unitPrice,
      status: opts.status === "completed" ? "completed" : "new",
      created_at: created,
    })),
  }
}

export function makeWfTrigger(opts: {
  id: string
  siteId: string
  instanceId: string
  userId: string
  name: string
  description: string
  kind?: "manual" | "cron" | "db_event" | "webhook"
  planType?: "objective" | "task" | "verification" | "milestone"
  x?: number
  y?: number
  extraTrigger?: Record<string, unknown>
}) {
  const now = isoNow()
  const kind = opts.kind || "manual"
  return {
    id: opts.id,
    parent_node_id: null,
    site_id: opts.siteId,
    instance_id: opts.instanceId,
    user_id: opts.userId,
    type: "wf-trigger",
    title: opts.name,
    prompt: { text: "When this workflow starts" },
    settings: {
      title: opts.name,
      enabled: true,
      ui_position: { x: opts.x ?? 80, y: opts.y ?? 80 },
      trigger: {
        kind,
        active_kinds: [kind],
        name: opts.name,
        description: opts.description,
        plan_type: opts.planType || "objective",
        ...(opts.extraTrigger || {}),
      },
    },
    result: {},
    status: "pending",
    created_at: now,
    updated_at: now,
  }
}

export function makeWfStep(opts: {
  id: string
  parentId: string
  siteId: string
  instanceId: string
  userId: string
  title: string
  prompt: string
  skill?: string
  role?: string
  x?: number
  y?: number
  status?: string
}) {
  const now = isoNow()
  const skill = opts.skill || "makinari-rol-workflow-step"
  return {
    id: opts.id,
    parent_node_id: opts.parentId,
    site_id: opts.siteId,
    instance_id: opts.instanceId,
    user_id: opts.userId,
    type: "wf-step",
    title: opts.title,
    prompt: { text: opts.prompt },
    settings: {
      title: opts.title,
      ui_position: { x: opts.x ?? 640, y: opts.y ?? 80 },
      step: {
        skill,
        role: opts.role || (skill === "makinari-rol-workflow-step" ? "assistant" : skill.replace(/^makinari-rol-/, "")),
        max_retries: 2,
        mcp_actions: [],
        validation_rules: [],
      },
    },
    result: {},
    status: opts.status || "pending",
    created_at: now,
    updated_at: now,
  }
}

export function weekdaySchedule(enabledDays: string[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]) {
  const days: Record<string, { enabled: boolean; start?: string; end?: string }> = {}
  for (const day of ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]) {
    days[day] = enabledDays.includes(day)
      ? { enabled: true, start: "07:00", end: "21:00" }
      : { enabled: false }
  }
  return days
}
