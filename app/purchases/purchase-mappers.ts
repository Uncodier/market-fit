import { Purchase, PurchaseItem, PurchaseLineInput, Payment } from "@/app/types"

export type { PurchaseLineInput }

export async function verifySiteMembership(supabase: any, userId: string, siteId: string) {
  const { data, error } = await supabase
    .from("sites")
    .select(`
      id,
      user_id,
      site_members (user_id, status)
    `)
    .eq("id", siteId)
    .single()

  if (error || !data) return false
  if (data.user_id === userId) return true
  return !!data.site_members?.some((m: any) => m.user_id === userId && m.status === "active")
}

export function mapItem(row: any): PurchaseItem {
  const catalog = Array.isArray(row.catalog_items) ? row.catalog_items[0] : row.catalog_items
  return {
    id: row.id,
    purchaseId: row.purchase_id,
    siteId: row.site_id,
    catalogItemId: row.catalog_item_id || null,
    name: row.name || "",
    quantity: Number(row.quantity) || 0,
    unitCost: Number(row.unit_cost) || 0,
    subtotal: Number(row.subtotal) || 0,
    catalogItemKind: catalog?.kind || null,
  }
}

export function mapPurchase(row: any): Purchase {
  const vendor = Array.isArray(row.vendor) ? row.vendor[0] : row.vendor
  const items = (row.purchase_items || []).map(mapItem)
  return {
    id: row.id,
    siteId: row.site_id,
    vendorCompanyId: row.vendor_company_id || null,
    vendorName: vendor?.name || null,
    vendorEmail: vendor?.email || null,
    lastEmailedAt: row.last_emailed_at || null,
    publicAccessToken: row.public_access_token || null,
    userId: row.user_id || null,
    title: row.title || "",
    status: row.status,
    amount: Number(row.amount) || 0,
    amountDue: Number(row.amount_due) || 0,
    currency: row.currency || "USD",
    payments: (row.payments || []) as Payment[],
    purchaseDate: row.purchase_date,
    locationId: row.location_id || null,
    accountingState: row.accounting_state || "pending",
    stockReceived: !!row.stock_received,
    notes: row.notes || null,
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function lineSubtotal(line: PurchaseLineInput) {
  return Math.round((Number(line.quantity) || 0) * (Number(line.unitCost) || 0) * 100) / 100
}
