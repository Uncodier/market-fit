/** Canonical module labels for nested procurement routes, before entity names load. */
export function procurementRouteTitle(pathname: string): string | null {
  const routes: [string, string][] = [
    ['/purchases/procurement/approvals', 'Approvals'],
    ['/purchases/requests', 'Purchase Requests'],
    ['/purchases/tenders', 'Tenders'],
    ['/purchases/rules', 'Procurement Rules'],
    ['/settings/procurement', 'Procurement Settings'],
    ['/suppliers', 'Suppliers'],
  ]
  const path = pathname.split(/[?#]/)[0]
  for (const [base, label] of routes) {
    if (path === base) return label
    if (path === `${base}/new`) return `Create ${label === 'Suppliers' ? 'Supplier' : label === 'Tenders' ? 'Tender' : 'Purchase Request'}`
    if (path.startsWith(`${base}/`)) return `${label} Details`
  }
  return null
}