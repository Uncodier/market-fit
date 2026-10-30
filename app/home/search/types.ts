export const searchCollections = ['orders', 'quotes', 'subscriptions', 'library', 'reservations', 'businesses',
  'credentials', 'submissions', 'drafts', 'opportunities', 'products', 'tenders'] as const
export type SearchCollection = typeof searchCollections[number]
export type SearchRow = {
  id: string; collection: SearchCollection; title: string; description: string; status: string; href: string
}
export type SearchSource = { collection: SearchCollection; rows: SearchRow[]; error?: boolean }

export function searchHref(query: string) {
  const params = new URLSearchParams({ q: query })
  return `/home/search?${params}`
}

export function filterSearchRows(sources: SearchSource[], query: string, collection = 'all') {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return sources.flatMap(source => source.rows).filter(row =>
    (collection === 'all' || row.collection === collection) &&
    words.every(word => `${row.title} ${row.description} ${row.status}`.toLocaleLowerCase().includes(word)))
}