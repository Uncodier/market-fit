import { procurementRouteTitle } from '@/lib/navigation/procurement-route-title'

test.each([
  ['/purchases/tenders', 'Tenders'], ['/purchases/requests', 'Purchase Requests'],
  ['/suppliers', 'Suppliers'], ['/purchases/tenders/new', 'Create Tender'],
  ['/purchases/requests/new', 'Create Purchase Request'], ['/suppliers/new', 'Create Supplier'],
  ['/purchases/procurement/approvals', 'Approvals'], ['/purchases/rules', 'Procurement Rules'],
  ['/settings/procurement', 'Procurement Settings'], ['/purchases/tenders/id', 'Tenders Details'],
  ['/purchases/tenders-other', null], ['/purchases/orders', null],
])('resolves %s without the generic Purchases Details title', (path, expected) => {
  expect(procurementRouteTitle(path)).toBe(expected)
})