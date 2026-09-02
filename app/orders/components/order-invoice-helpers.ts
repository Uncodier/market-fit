export const ORDER_ROW_STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-50/50 dark:bg-gray-900/50",
  new: "bg-amber-50/50 dark:bg-amber-950/30",
  preparing: "bg-blue-50/50 dark:bg-blue-950/30",
  completed: "bg-green-50/50 dark:bg-green-950/30",
}

export const ORDER_LINE_STATUS_STYLES: Record<string, string> = {
  draft: "bg-white text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  new: "bg-white text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900",
  preparing: "bg-white text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900",
  completed: "bg-white text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-900",
}

type Translate = (key: string) => string | undefined

export function paymentMethodLabel(method: string | null | undefined, t: Translate): string {
  if (!method) return t("common.na") || "N/A"
  const key = method.toLowerCase()
  const map: Record<string, string> = {
    cash: t("sales.paymentMethod.cash") || "Cash",
    credit_card: t("sales.paymentMethod.creditCard") || "Credit Card",
    debit_card: t("sales.paymentMethod.debitCard") || "Debit Card",
    bank_transfer: t("sales.paymentMethod.bankTransfer") || "Bank Transfer",
    wire_transfer: t("sales.paymentMethod.wireTransfer") || "Wire Transfer",
    check: t("sales.paymentMethod.check") || "Check",
    crypto: t("sales.paymentMethod.crypto") || "Cryptocurrency",
    card: t("sales.paymentMethod.creditCard") || "Card",
    stripe: "Stripe",
  }
  return map[key] || method.replace(/_/g, " ")
}

export function displayPaymentMethod(sale?: {
  payments?: Array<{ date: string; method: string }>
  payment_method?: string | null
} | null): string | null {
  if (!sale) return null
  if (sale.payments && sale.payments.length > 0) {
    const latestPayment = [...sale.payments].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0]
    return latestPayment.method
  }
  return sale.payment_method || null
}

export function orderSourceLabel(source: string | null | undefined, t: Translate): string {
  if (!source) return t("common.na") || "N/A"
  if (source === "online" || source === "shop" || source === "marketplace") {
    return t("orders.kanban.sourceOnline") || t("sales.source.online") || "Online"
  }
  if (source === "retail") return t("sales.source.retail") || "Retail"
  return t("orders.kanban.sourcePos") || t("sales.source.pos") || "POS"
}

export function fulfillmentLabel(method: string | null | undefined, t: Translate): string | null {
  if (!method || method === "none") return null
  return t(`orders.kanban.fulfillment.${method}`) || method.replace(/_/g, " ")
}

export function parseItemName(name: string, parentNameFromMeta?: string | null) {
  if (parentNameFromMeta) {
    return { parentName: parentNameFromMeta, variantName: name }
  }
  if (name.includes(" -> ")) {
    const parts = name.split(" -> ")
    return { parentName: parts[0], variantName: parts.slice(1).join(" -> ") }
  }
  return { parentName: null, variantName: name }
}
