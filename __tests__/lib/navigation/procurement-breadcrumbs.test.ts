import {
  enforceInvariants,
  getSection,
  hasId,
  reduceBreadcrumb,
} from '@/lib/navigation/breadcrumb-engine'

const roots = [
  ['/purchases/requests', 'Purchase Requests'],
  ['/purchases/tenders', 'Tenders'],
  ['/purchases/rules', 'Procurement Rules'],
  ['/purchases/procurement/approvals', 'Approvals'],
  ['/purchases/orders', 'Online purchases'],
  ['/purchases/quotes', 'Received Quotes'],
  ['/purchases/subscriptions', 'Online subscriptions'],
  ['/purchases/library', 'Assets'],
  ['/settings/procurement', 'Procurement Settings'],
  ['/inventory/minimums', 'Inventory minimums'],
  ['/suppliers', 'Suppliers'],
]

const navigate = (path: string, label: string) => ({
  type: 'navigate' as const, path, label, timestamp: 1000,
})

describe('procurement breadcrumbs', () => {
  test.each(roots)('%s is an independent sidebar root', (path, label) => {
    expect(getSection(path)).toBe(path)
    expect(hasId(`${path}?tab=all`)).toBe(false)
    for (const origin of ['/chat', '/purchases/requests/old']) {
      const state = reduceBreadcrumb([{ path: origin, label: 'Previous screen', timestamp: 1 }],
        navigate(path, label))
      expect(state).toEqual([{ path, label, timestamp: 1000 }])
    }
  })

  test.each(roots.slice(0, 8))('%s details use a real parent instead of Purchases', (path, label) => {
    const state = reduceBreadcrumb([{ path: '/chat', label: 'Chat', timestamp: 1 }],
      navigate(`${path}/entity`, 'Entity'))
    expect(hasId(`${path}/entity`)).toBe(true)
    expect(state).toEqual([
      { path, label, timestamp: 999 },
      { path: `${path}/entity`, label: 'Entity', timestamp: 1000 },
    ])
  })

  test('keeps the request root for creation, title updates and sibling details', () => {
    let state = reduceBreadcrumb([], navigate('/purchases/requests', 'Purchase Requests'))
    state = reduceBreadcrumb(state, navigate('/purchases/requests/new', 'Create Purchase Request'))
    state = reduceBreadcrumb(state, navigate('/purchases/requests/id', 'Request Details'))
    state = reduceBreadcrumb(state, { type: 'update', title: 'Office supplies', path: '/purchases/requests/id' })
    expect(state.map(({ path, label }) => ({ path, label }))).toEqual([
      { path: '/purchases/requests', label: 'Purchase Requests' },
      { path: '/purchases/requests/id', label: 'Office supplies' },
    ])
  })

  test('cleans persisted Purchases ancestors and resets stale trails at module roots', () => {
    const stale = [
      { path: '/purchases', label: 'Compras', timestamp: 1 },
      { path: '/purchases/requests', label: 'Purchase Requests', timestamp: 2 },
      { path: '/purchases/requests/id', label: 'Office supplies', timestamp: 3 },
    ]
    expect(enforceInvariants(stale)).toEqual(stale.slice(1))
    const root = { path: '/purchases/rules', label: 'Procurement Rules', timestamp: 4 }
    expect(enforceInvariants([...stale, root])).toEqual([root])
  })

  test('does not match unrelated routes with similar prefixes', () => {
    expect(getSection('/purchases/requests-other')).toBe('/purchases')
    expect(getSection('/settings/procurement-other')).toBe('/settings')
  })
})