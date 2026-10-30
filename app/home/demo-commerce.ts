import { demoCourseMetadata } from './demo-course'

// Local presentation fixtures shared by account lists and their detail previews.
const site = { id: 'demo-acme', name: 'Acme Workplace' }
const created = '2026-10-20T10:00:00Z'
const catalogItem = (id: string, name: string, digital_subtype = 'file') => ({
  id, name, description: `${name} from Acme Workplace.`, digital_subtype,
  image_url: '/images/logo.png', currency: 'USD',
})

export const demoAccountOrders = Array.from({ length: 12 }, (_, index) => ({
  id: `demo-order-${index + 1}`, order_number: `DEMO-${1001 + index}`,
  status: index < 2 ? 'pending' : index === 11 ? 'cancelled' : 'completed',
  created_at: created, total: 120 + index * 25, currency: 'USD', site,
  subtotal: 120 + index * 25, discount_total: 0, tax_total: 0,
  fulfillment_method: 'ship',
  shipping_address: { line1: '123 Demo Street', city: 'Example City', state: 'CA', zip: '00000', country: 'US' },
  sales: [{ status: index < 2 ? 'pending' : index === 11 ? 'cancelled' : 'paid',
    amount: index < 2 || index === 11 ? 0 : 120 + index * 25,
    amount_due: index < 2 ? 120 + index * 25 : 0 }],
  shipments: index >= 2 && index < 11 ? [{ id: `demo-shipment-${index + 1}`, status: 'delivered',
    carrier: 'Demo Delivery', tracking_number: `DEMO-TRACK-${1001 + index}` }] : [],
  sale_order_items: [{ id: `demo-order-item-${index + 1}`, name: ['Ergonomic keyboard', 'Workspace starter kit', 'Studio headphones'][index % 3],
    unit_price: 120 + index * 25, subtotal: 120 + index * 25,
    quantity: 1, catalog_item: catalogItem(`demo-product-${index}`, 'Workspace equipment') }],
}))

export const demoAccountSubscriptions = ['Workspace membership', 'Learning essentials', 'Design resources'].map((name, index) => ({
  id: `demo-subscription-${index + 1}`, status: ['active', 'paused', 'cancelled'][index],
  site, catalog_item: catalogItem(`demo-plan-${index}`, name), amount: 29 + index * 20,
  start_date: created, next_billing_date: index === 0 ? '2030-11-20T10:00:00Z' : null,
  entitlements: [],
}))

export const demoAccountQuotes = ['sent', 'sent', 'accepted', 'rejected'].map((status, index) => ({
  id: `demo-account-quote-${index + 1}`, status, site, total: 600 + index * 150,
  currency: 'USD', created_at: created, valid_until: '2030-12-01T10:00:00Z',
}))

export const demoAccountLibrary = ([['course', 3, 'Product design foundations'], ['ticket', 2, 'Community summit'],
  ['file', 8, 'Brand resource pack'], ['pass', 5, 'Studio day pass']] as const).flatMap(([subtype, count, name]) =>
  Array.from({ length: count }, (_, index) => ({
    id: `demo-${subtype}-${index + 1}`, site, granted_at: created, status: 'active',
    catalog_item: {
      ...catalogItem(`demo-asset-${subtype}-${index}`, `${name} ${index + 1}`, subtype),
      ...(subtype === 'course' ? {
        description: 'Learn to move from a meaningful customer problem to a thoughtful, testable product experience.',
        metadata: demoCourseMetadata,
      } : {}),
    },
    uses_remaining: subtype === 'pass' ? 5 - index : null,
  })))

export function filterDemoAccountRows<T>(rows: T[], { q = '', status = 'all', page = 1, pageSize = 50 }: {
  q?: string; status?: string; page?: number; pageSize?: number
}) {
  const filtered = rows.filter(row => {
    const record = row as { status?: string }
    return (status === 'all' || record.status === status) && JSON.stringify(row).toLowerCase().includes(q.toLowerCase())
  })
  return { data: filtered.slice((page - 1) * pageSize, page * pageSize), count: filtered.length }
}

export function demoAccountDetailPath(kind: string, id: string) {
  return `/home/preview/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`
}