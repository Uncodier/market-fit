export type DocumentLineItem = {
  name: string
  quantity: number
  unit_price: number
  subtotal: number
  status?: string | null
}

/** Normalize sale/order/bill line payloads (snake_case or camelCase) for document views. */
export function mapDocumentLineItems(items: any[] | null | undefined): DocumentLineItem[] {
  return (items || []).map((item) => {
    const quantity = Number(item?.quantity) || 0
    const unit_price =
      Number(item?.unit_price ?? item?.unitPrice ?? item?.unitCost) || 0
    const hasSubtotal = item?.subtotal != null || item?.subTotal != null
    const subtotal = hasSubtotal
      ? Number(item.subtotal ?? item.subTotal) || 0
      : unit_price * quantity

    return {
      name: String(item?.name || "Item"),
      quantity,
      unit_price,
      subtotal,
      status: item?.status ? String(item.status) : null,
    }
  })
}
