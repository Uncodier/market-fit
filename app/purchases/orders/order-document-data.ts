export type Money = number | string | null

export interface OrderAddress {
  name?: string | null
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
}

interface CatalogSummary {
  name?: string | null
  kind?: string | null
  digital_subtype?: string | null
}

export interface OrderLine {
  id?: string
  name?: string | null
  description?: string | null
  quantity?: Money
  unitPrice?: Money
  unit_price?: Money
  subtotal?: Money
  catalog_item_id?: string | null
  catalog_item?: CatalogSummary | null
  parent_sale_order_item_id?: string | null
  metadata?: {
    is_modifier?: boolean
    parent_name?: string | null
    client_line_key?: string
    parent_client_line_key?: string
  } | null
}

export interface OrderPayment {
  status?: string | null
  amount?: Money
  amount_due?: Money
  payment_method?: string | null
  payments?: { date?: string; method?: string; amount?: Money }[] | null
}

export interface OrderShipment {
  id: string
  status?: string | null
  carrier?: string | null
  tracking_number?: string | null
  estimated_delivery_at?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  shipping_address?: OrderAddress | null
}

export interface OrderAccess {
  id: string
  status?: string | null
  catalog_item?: CatalogSummary | null
}

// Display-only projection of the existing getBuyerOrder result, not a new API.
export interface WorkspaceOrder {
  id: string
  order_number?: string | null
  owner_site_id?: string | null
  site?: { id: string; name?: string | null } | null
  status?: string | null
  created_at?: string | null
  due_date?: string | null
  scheduled_for?: string | null
  notes?: string | null
  currency?: string | null
  subtotal?: Money
  discount_total?: Money
  tax_total?: Money
  total?: Money
  fulfillment_method?: string | null
  shipping_address?: OrderAddress | null
  sale_order_items?: OrderLine[] | null
  items?: OrderLine[] | null
  sales?: OrderPayment[] | null
  shipments?: OrderShipment[] | null
  entitlements?: OrderAccess[] | null
  reservations?: OrderAccess[] | null
}

export function orderLines(order: WorkspaceOrder) {
  return order.sale_order_items?.length ? order.sale_order_items : order.items || []
}

export function lineAmounts(line: OrderLine) {
  const quantity = Number(line.quantity ?? 1)
  const price = Number(line.unitPrice ?? line.unit_price ?? 0)
  return { quantity, price, subtotal: Number(line.subtotal ?? price * quantity) }
}

export function lineName(line: OrderLine) {
  const name = line.name || line.catalog_item?.name || 'Item'
  if (line.metadata?.parent_name) return { name: line.metadata.parent_name, variant: name }
  const [parent, ...variant] = name.split(' -> ')
  return variant.length ? { name: parent, variant: variant.join(' -> ') } : { name, variant: null }
}

export function groupedLines(order: WorkspaceOrder) {
  const lines = orderLines(order)
  const isModifier = (line: OrderLine) => Boolean(line.metadata?.is_modifier || line.parent_sale_order_item_id)
  const parents = lines.filter(line => !isModifier(line))
  const children = lines.filter(isModifier)
  const belongsTo = (child: OrderLine, parent: OrderLine) => Boolean(
    (child.parent_sale_order_item_id && child.parent_sale_order_item_id === parent.id) ||
    (child.metadata?.parent_client_line_key && child.metadata.parent_client_line_key === parent.metadata?.client_line_key)
  )
  return [
    ...parents.map(line => ({ line, modifiers: children.filter(child => belongsTo(child, line)) })),
    ...children.filter(child => !parents.some(parent => belongsTo(child, parent))).map(line => ({ line, modifiers: [] })),
  ]
}

export function money(amount: Money | undefined, currency?: string | null) {
  const value = Number(amount ?? 0)
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency || 'USD'}`
  }
}

export function orderDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(date)
}

export function paymentMethod(payment: OrderPayment) {
  const latest = [...(payment.payments || [])].sort((a, b) =>
    new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  )[0]
  return latest?.method || payment.payment_method
}

export function accessDestination(access: OrderAccess) {
  const item = access.catalog_item
  if (item?.kind !== 'digital_asset') return { href: '/buyer/library', label: 'View Access' }
  switch (item.digital_subtype) {
    case 'course': return { href: `/buyer/course/${access.id}`, label: 'View Course' }
    case 'ticket': return { href: `/buyer/ticket/${access.id}`, label: 'View Ticket' }
    case 'pass': return { href: `/buyer/book/${access.id}`, label: 'View Pass' }
    default: return { href: `/buyer/downloads/${access.id}`, label: 'View Asset' }
  }
}
