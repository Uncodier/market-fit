import { localeMessages } from '@/app/context/locale-catalog'

/** Canonical module labels for nested procurement routes, before entity names load. */
export function procurementRouteTitle(pathname: string, t?: (key: string) => string): string | null {
  if (pathname.split(/[?#]/)[0] === '/inventory/minimums') {
    const key = 'procurement.policy.page.minimums';
    const label = t?.(key);
    return label && label !== key ? label : localeMessages.en[key];
  }
  const routes: [string, string][] = [
    ['/purchases/procurement/approvals', 'approvals'],
    ['/purchases/requests', 'requests'],
    ['/purchases/tenders', 'tenders'],
    ['/purchases/rules', 'rules'],
    ['/settings/procurement', 'settings'],
    ['/suppliers', 'suppliers'],
  ]
  const translate = (name: string) => {
    const key = `procurement.navigation.${name}`
    const translated = t?.(key)
    return translated && translated !== key ? translated : localeMessages.en[key] ?? name
  }
  const path = pathname.split(/[?#]/)[0]
  for (const [base, label] of routes) {
    if (path === base) return translate(label)
    if (path === `${base}/new`) return translate(label === 'suppliers' ? 'createSupplier' : label === 'tenders' ? 'createTender' : 'createRequest')
    if (path.startsWith(`${base}/`)) return translate(`${label}Details`)
  }
  return null
}