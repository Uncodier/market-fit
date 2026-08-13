export function journalSourceHref(entry: {
  source_type?: string | null
  source_id?: string | null
}): string | null {
  if (!entry.source_id) return null
  switch (entry.source_type) {
    case "sale":
      return `/sales/${entry.source_id}`
    case "expense":
      return `/transactions/${entry.source_id}`
    case "purchase":
      return `/bills/${entry.source_id}`
    default:
      return null
  }
}

export function journalSourceActionKey(sourceType?: string | null): {
  key: string
  fallback: string
} {
  switch (sourceType) {
    case "sale":
      return { key: "accounting.openSale", fallback: "Open sale" }
    case "expense":
      return { key: "accounting.openExpense", fallback: "Open expense" }
    case "purchase":
      return { key: "accounting.openBill", fallback: "Open bill" }
    default:
      return { key: "accounting.openSource", fallback: "Open source document" }
  }
}
