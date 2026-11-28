type EmojiRow = readonly string[]
type EmojiCatalog = Record<string, readonly EmojiRow[]>

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

export function indexEmojiCatalog(catalog: EmojiCatalog) {
  return Object.entries(catalog).flatMap(([group, rows]) => rows.map(([emoji, name, spanish, keywords]) => ({
    emoji, name, spanish, group, search: normalize(`${emoji} ${name} ${spanish} ${group} ${keywords}`),
  })))
}

export type IndexedEmoji = ReturnType<typeof indexEmojiCatalog>[number]

let pending: Promise<IndexedEmoji[]> | undefined
export function loadEmojiCatalog() {
  return pending ??= import("./emoji-catalog.json").then(module => indexEmojiCatalog(module.default)).catch(error => {
    pending = undefined
    throw error
  })
}

export function searchEmojiCatalog(catalog: IndexedEmoji[], query: string) {
  const normalized = normalize(query.trim())
  if (!normalized) return catalog
  const terms = normalized.split(/\s+/)
  const matches = catalog.filter(entry => terms.every(term => entry.search.includes(term)))
  // Put direct symbol or name matches ahead of broad keyword matches.
  const rank = (entry: IndexedEmoji) => [entry.emoji, entry.name, entry.spanish].some(value => normalize(value) === normalized) ? 0
    : [entry.name, entry.spanish].some(value => normalize(value).startsWith(normalized)) ? 1 : 2
  return matches.map(entry => ({ entry, rank: rank(entry) })).sort((a, b) => a.rank - b.rank).map(({ entry }) => entry)
}