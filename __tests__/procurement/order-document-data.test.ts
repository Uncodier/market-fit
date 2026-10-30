import {
  accessDestination, groupedLines, lineAmounts, lineName, money, orderDate, orderLines, paymentMethod,
  type WorkspaceOrder,
} from '@/app/purchases/orders/order-document-data'

it('prefers relational lines but falls back to stored JSON items', () => {
  const order: WorkspaceOrder = { id: 'one', sale_order_items: [{ name: 'Related' }], items: [{ name: 'Legacy' }] }
  expect(orderLines(order)[0].name).toBe('Related')
  expect(orderLines({ ...order, sale_order_items: [] })[0].name).toBe('Legacy')
  expect(orderLines({ id: 'empty' })).toEqual([])
})

it('preserves explicit zero prices, quantities and subtotals and accepts numeric strings', () => {
  expect(lineAmounts({ quantity: 0, unitPrice: 0, unit_price: 99, subtotal: 0 })).toEqual({ quantity: 0, price: 0, subtotal: 0 })
  expect(lineAmounts({ quantity: '2', unit_price: '12.50' })).toEqual({ quantity: 2, price: 12.5, subtotal: 25 })
  expect(lineAmounts({ quantity: 3, unit_price: 10, subtotal: 20 })).toEqual({ quantity: 3, price: 10, subtotal: 20 })
})

it('groups modifiers by database parent or client key and does not lose orphan extras', () => {
  const parent = { id: 'parent', name: 'Main', metadata: { client_line_key: 'client-key' } }
  const child = { id: 'child', parent_sale_order_item_id: 'parent', name: 'Child' }
  const legacyChild = { name: 'Legacy extra', metadata: { is_modifier: true, parent_client_line_key: 'client-key' } }
  const orphan = { name: 'Orphan', metadata: { is_modifier: true } }
  expect(groupedLines({ id: 'one', sale_order_items: [child, parent, legacyChild, orphan] })).toEqual([
    { line: parent, modifiers: [child, legacyChild] }, { line: orphan, modifiers: [] },
  ])
})

it('retains parent and variant names', () => {
  expect(lineName({ name: 'Coffee -> Large -> Hot' })).toEqual({ name: 'Coffee', variant: 'Large -> Hot' })
  expect(lineName({ name: 'Large', metadata: { parent_name: 'Coffee' } })).toEqual({ name: 'Coffee', variant: 'Large' })
})

it.each([
  ['course', '/buyer/course/access', 'View Course'],
  ['ticket', '/buyer/ticket/access', 'View Ticket'],
  ['pass', '/buyer/book/access', 'View Pass'],
  ['file', '/buyer/downloads/access', 'View Asset'],
])('keeps the buyer destination for digital %s', (subtype, href, label) => {
  expect(accessDestination({ id: 'access', catalog_item: { kind: 'digital_asset', digital_subtype: subtype } })).toEqual({ href, label })
})

it('keeps generic library access and the latest payment method with legacy fallback', () => {
  expect(accessDestination({ id: 'access' }).href).toBe('/buyer/library')
  expect(paymentMethod({ payment_method: 'cash', payments: [
    { date: '2026-10-03', method: 'card' }, { date: '2026-10-01', method: 'cash' },
  ] })).toBe('card')
  expect(paymentMethod({ payment_method: 'cash' })).toBe('cash')
})

it('handles missing dates and currency without crashing', () => {
  expect(orderDate(null)).toBe('—')
  expect(orderDate('invalid')).toBe('invalid')
  expect(money('12.5', 'EUR')).toBe('€12.50')
  expect(money(0)).toBe('$0.00')
  expect(money(12.5, 'bad-currency')).toBe('12.50 bad-currency')
})
