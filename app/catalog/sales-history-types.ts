export type CatalogSaleRow = {
  id: string
  orderId: string
  orderNumber: string
  saleId: string
  date: string
  itemName: string
  quantity: number
  revenue: number
  currency: string
  source: string
  status: string
}

export type CatalogSalesHistory = {
  rows: CatalogSaleRow[]
  availableCurrencies: string[]
}

/** Amounts are line subtotals, not whole-order receipts or net collected cash. */
export function summarizeCatalogSales(rows: CatalogSaleRow[]) {
  const revenue = rows.reduce((total, row) => total + row.revenue, 0)
  const units = rows.reduce((total, row) => total + row.quantity, 0)
  const orders = new Set(rows.map(row => row.orderId)).size
  const days = new Map<string, { date: string; revenue: number; units: number }>()
  for (const row of rows) {
    const date = row.date.slice(0, 10)
    const day = days.get(date) || { date, revenue: 0, units: 0 }
    day.revenue += row.revenue
    day.units += row.quantity
    days.set(date, day)
  }
  return { revenue, units, orders, averagePrice: units ? revenue / units : 0,
    trend: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) }
}