export type Amount = number | string | null | undefined

export interface BuyerOrderItem {
  id?: string
  name: string
  description?: string | null
  catalog_item_id?: string | null
  parent_sale_order_item_id?: string | null
  quantity: number
  unit_price?: Amount
  unitPrice?: Amount
  subtotal?: Amount
  metadata?: { is_modifier?: boolean; parent_name?: string; client_line_key?: string; parent_client_line_key?: string }
  catalog_item?: { id?: string; name?: string; image_url?: string | null; kind?: string; digital_subtype?: string }
}

export interface BuyerPayment {
  id?: string
  date: string
  amount: Amount
  method?: string | null
}

export interface BuyerSale {
  status?: string
  source?: string
  amount?: Amount
  amount_due?: Amount
  payment_method?: string | null
  payments?: BuyerPayment[] | null
}

export interface BuyerAddress {
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  postal_code?: string | null
  country?: string | null
}

export interface BuyerShipment {
  id: string
  status?: string
  carrier?: string | null
  tracking_number?: string | null
  estimated_delivery_at?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  shipping_address?: BuyerAddress | null
}

export interface BuyerAccessItem {
  id: string
  status?: string
  catalog_item?: BuyerOrderItem['catalog_item'] | null
}

export interface BuyerOrderDetail {
  id: string
  public_access_token?: string | null
  public_access_token_expires_at?: string | null
  public_access_token_revoked_at?: string | null
  order_number?: string
  created_at: string
  status?: string
  currency?: string
  subtotal?: Amount
  discount_total?: Amount
  tax_total?: Amount
  shipping_cost?: Amount
  total?: Amount
  fulfillment_method?: string | null
  scheduled_for?: string | null
  shipping_address?: BuyerAddress | null
  site?: { id: string; name: string } | null
  items?: BuyerOrderItem[]
  sale_order_items?: BuyerOrderItem[]
  sales?: BuyerSale[] | BuyerSale | null
  shipments?: BuyerShipment[]
  entitlements?: BuyerAccessItem[]
  reservations?: BuyerAccessItem[]
}

export type Translate = (key: string, params?: Record<string, string | number>) => string

export function recordedAmount(value: Amount): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function paymentAmounts(sale: BuyerSale) {
  const total = recordedAmount(sale.amount)
  const due = recordedAmount(sale.amount_due)
  // The sale amount is the charge, not the amount actually paid.
  const paid = total !== null && due !== null && total >= 0 && due >= 0 && due <= total
    ? Math.round((total - due) * 100) / 100 : null
  return { paid, due }
}

export function formatOrderDate(value: string | null | undefined, locale: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function displayValue(value: string | null | undefined, namespace: string, t: Translate): string {
  if (!value) return t('buyer.orders.detail.unknown')
  const key = `${namespace}.${value.toLowerCase()}`
  const translated = t(key)
  return translated !== key ? translated : value.replaceAll('_', ' ')
}

export function addressLines(address?: BuyerAddress | null): string[] {
  if (!address) return []
  return [address.line1, address.line2,
    [address.city, address.state, address.zip || address.postal_code].filter(Boolean).join(' '),
    address.country].filter((line): line is string => Boolean(line?.trim()))
}

export function getOrderSales(order: BuyerOrderDetail): BuyerSale[] {
  return Array.isArray(order.sales) ? order.sales : order.sales ? [order.sales] : []
}

export function statusTone(status?: string): string {
  if (['completed', 'delivered', 'paid', 'active'].includes(status || '')) {
    return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20'
  }
  if (['cancelled', 'failed', 'revoked'].includes(status || '')) {
    return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
  }
  return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20'
}