type Named = { name?: string | null }

export type SaleMemoSource = {
  id: string
  title?: string | null
  product_name?: string | null
  invoice_number?: string | number | null
  reference_code?: string | null
  leads?: Named | Named[] | null
  companies?: Named | Named[] | null
}

export type ExpenseMemoSource = {
  id: string
  description?: string | null
  category?: string | null
}

export type PurchaseMemoSource = {
  id: string
  title?: string | null
  notes?: string | null
  vendor?: Named | Named[] | null
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const ID_MEMO_RE = /^(sale|expense|purchase)\s+[0-9a-f-]{8,}$/i

function relationName(value: Named | Named[] | null | undefined): string | null {
  if (!value) return null
  const row = Array.isArray(value) ? value[0] : value
  const name = row?.name?.trim()
  return name || null
}

function isGenericIdMemo(memo?: string | null, sourceId?: string | null): boolean {
  const value = memo?.trim()
  if (!value) return true
  if (sourceId && value.includes(sourceId)) return true
  if (UUID_RE.test(value) && value.replace(UUID_RE, "").trim().length <= 8) return true
  return ID_MEMO_RE.test(value)
}

function cleanSaleTitle(sale: SaleMemoSource): string | null {
  const product = sale.product_name?.trim() || null
  const title = sale.title?.trim() || null
  if (!title) return product
  if (title.toLowerCase().startsWith("order -")) return product
  if (sale.id && title.includes(sale.id)) return product
  if (UUID_RE.test(title)) return product
  return title
}

export function memoFromSale(sale: SaleMemoSource): string {
  const customer = relationName(sale.leads) || relationName(sale.companies)
  const ref = String(sale.invoice_number || sale.reference_code || "").trim()
  const title = cleanSaleTitle(sale)

  if (ref && customer) return `#${ref} · ${customer}`
  if (ref) return `#${ref}`
  if (title && customer) return `${title} · ${customer}`
  if (customer) return customer
  if (title) return title
  return "Sale"
}

export function memoFromExpense(tx: ExpenseMemoSource): string {
  const description = tx.description?.trim()
  if (description && !isGenericIdMemo(description, tx.id)) return description
  const category = (tx.category || "").replace(/_/g, " ").trim()
  if (category && category !== "other") {
    return category.charAt(0).toUpperCase() + category.slice(1)
  }
  return "Expense"
}

export function memoFromPurchase(purchase: PurchaseMemoSource): string {
  const vendor = relationName(purchase.vendor)
  const title = purchase.title?.trim()
  if (title && !isGenericIdMemo(title, purchase.id)) {
    return vendor ? `${title} · ${vendor}` : title
  }
  if (vendor) return vendor
  const notes = purchase.notes?.trim()
  if (notes) return notes.length > 80 ? `${notes.slice(0, 77)}…` : notes
  return "Bill"
}

export function resolveJournalMemo(
  sourceType: string | null | undefined,
  source: SaleMemoSource | ExpenseMemoSource | PurchaseMemoSource | null | undefined,
  storedMemo?: string | null,
  sourceId?: string | null
): string {
  if (source) {
    if (sourceType === "sale") return memoFromSale(source as SaleMemoSource)
    if (sourceType === "expense") return memoFromExpense(source as ExpenseMemoSource)
    if (sourceType === "purchase") return memoFromPurchase(source as PurchaseMemoSource)
  }

  const memo = storedMemo?.trim()
  if (memo && !isGenericIdMemo(memo, sourceId)) return memo
  if (sourceType === "opening") return "Opening balances"
  if (sourceType === "manual") return memo || "Untitled entry"
  if (sourceType === "sale") return "Sale"
  if (sourceType === "expense") return "Expense"
  if (sourceType === "purchase") return "Bill"
  return memo || "Journal entry"
}
