export interface HistoryItem {
  path: string
  label: string
  timestamp: number
}

export type BreadcrumbEvent =
  | { type: 'navigate'; path: string; label: string; timestamp?: number }
  | { type: 'update'; title?: string | null; parent?: { title: string; path: string }; path?: string; section?: string }
  | { type: 'reset' }

const ID_PARAMS = [
  'id', 'agentId', 'conversationId', 'leadId', 'segmentId', 'campaignId',
  'experimentId', 'requirementId', 'contentId', 'saleId', 'robotId', 'instance',
]

const SECTION_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/chat': 'Chat',
  '/leads': 'Leads',
  '/catalog': 'Catalog',
  '/orders': 'Orders',
  '/campaigns': 'Campaigns',
  '/content': 'Content',
  '/segments': 'Segments',
  '/agents': 'Agents',
  '/robots': 'Agents',
  '/control-center': 'Control Center',
  '/sales': 'Sales',
  '/deals': 'Deals',
  '/shipments': 'Shipments',
  '/requirements': 'Requirements',
  '/experiments': 'Experiments',
  '/promotions': 'Promotions',
  '/price-lists': 'Price Lists',
  '/inventory': 'Inventory',
  '/subscriptions': 'Subscriptions',
  '/reservations': 'Reservations',
  '/visits': 'Visits',
  '/applications/database': 'Database',
  '/purchases': 'Purchases',
  '/buyer': 'Buyer',
}

export function getScreenKey(fullPath: string): string {
  const [pathname, search] = fullPath.split('?')
  const params = new URLSearchParams(search || '')
  const idParts: string[] = []
  for (const param of ID_PARAMS) {
    if (params.has(param)) {
      idParts.push(`${param}=${params.get(param)}`)
    }
  }
  idParts.sort()
  return `${pathname}${idParts.length > 0 ? `?${idParts.join('&')}` : ''}`
}

export function getSection(fullPath: string): string {
  const pathname = fullPath.split('?')[0]
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return '/'
  if (segments[0] === 'applications' && segments[1] === 'database') {
    return '/applications/database'
  }
  return `/${segments[0]}`
}

function hasId(fullPath: string): boolean {
  const [pathname, search] = fullPath.split('?')
  const segments = pathname.split('/').filter(Boolean)
  const sectionSegmentsCount = getSection(fullPath).split('/').filter(Boolean).length
  const params = new URLSearchParams(search || '')
  return segments.length > sectionSegmentsCount || ID_PARAMS.some((param) => params.has(param))
}

function normalizeLabel(label: string): string {
  const value = label.toLowerCase().trim()
  if (value === 'chat' || value === 'conversations') return 'conversations'
  return value
}

function sectionRootItem(item: HistoryItem, timestamp?: number): HistoryItem {
  const section = getSection(item.path)
  const label = !hasId(item.path) ? item.label : (SECTION_TITLES[section] || item.label)
  return {
    path: section,
    label,
    timestamp: timestamp ?? item.timestamp,
  }
}

export function enforceInvariants(items: HistoryItem[]): HistoryItem[] {
  if (items.length === 0) return items

  const result: HistoryItem[] = [items[0]]
  for (let i = 1; i < items.length; i++) {
    const prev = result[result.length - 1]
    const curr = items[i]
    if (getScreenKey(prev.path) === getScreenKey(curr.path)) {
      result[result.length - 1] = curr
      continue
    }
    if (normalizeLabel(prev.label) === normalizeLabel(curr.label)) {
      result[result.length - 1] = curr
      continue
    }
    result.push(curr)
  }
  return result.slice(-5)
}

function item(path: string, label: string, timestamp: number): HistoryItem {
  return { path, label, timestamp }
}

export function reduceBreadcrumb(items: HistoryItem[], event: BreadcrumbEvent): HistoryItem[] {
  if (event.type === 'reset') return []

  if (event.type === 'navigate') {
    const timestamp = event.timestamp || Date.now()
    const newItem = item(event.path, event.label, timestamp)
    const currentSection = getSection(event.path)
    const isRoot = !hasId(event.path)

    if (isRoot) {
      return enforceInvariants([newItem])
    }

    // Chat list and conversation are one crumb: the section root.
    if (currentSection === '/chat') {
      const origin = items[0] && getSection(items[0].path) === '/chat'
        ? sectionRootItem(items[0], timestamp)
        : item('/chat', 'Chat', timestamp)
      return enforceInvariants([origin])
    }

    if (items.length === 0) {
      return enforceInvariants([newItem])
    }

    const lastItem = items[items.length - 1]
    const lastSection = getSection(lastItem.path)

    if (getScreenKey(event.path) === getScreenKey(lastItem.path)) {
      return enforceInvariants([...items.slice(0, -1), newItem])
    }

    if (currentSection === lastSection && hasId(lastItem.path)) {
      return enforceInvariants([...items.slice(0, -1), newItem])
    }

    if (currentSection === lastSection && !hasId(lastItem.path)) {
      return enforceInvariants([...items, newItem])
    }

    const origin = sectionRootItem(items[0], items[0].timestamp)
    return enforceInvariants([origin, newItem])
  }

  if (event.type === 'update') {
    if (items.length === 0) return items

    let targetPath = event.path || undefined
    if (!targetPath && typeof window !== 'undefined') {
      targetPath = `${window.location.pathname}${window.location.search}`
    }

    const newItems = [...items]
    const lastItem = newItems[newItems.length - 1]
    const isTargetingLast = !targetPath || getScreenKey(targetPath) === getScreenKey(lastItem.path)

    if (isTargetingLast && event.title) {
      newItems[newItems.length - 1] = {
        ...lastItem,
        label: event.title,
        ...(targetPath ? { path: targetPath } : {}),
      }
    }

    if (event.parent && isTargetingLast) {
      const currentSection = getSection(lastItem.path)
      const parentSection = getSection(event.parent.path)
      const hasCrossSectionOrigin =
        newItems.length > 1 && getSection(newItems[newItems.length - 2].path) !== currentSection

      if (parentSection === currentSection && !hasCrossSectionOrigin) {
        const prevItem = newItems.length > 1 ? newItems[newItems.length - 2] : null
        if (prevItem && getScreenKey(prevItem.path) === getScreenKey(event.parent.path)) {
          newItems[newItems.length - 2] = { ...prevItem, label: event.parent.title }
        } else if (!prevItem || getSection(prevItem.path) === currentSection) {
          newItems.splice(newItems.length - 1, 0, {
            path: event.parent.path,
            label: event.parent.title,
            timestamp: lastItem.timestamp - 1,
          })
        }
      }
    }

    return enforceInvariants(newItems)
  }

  return items
}
