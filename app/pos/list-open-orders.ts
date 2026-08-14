import { selectPosOpenOrders } from "@/app/pos/open-orders";

const OPEN_ORDER_STATUSES = ["pending", "in_progress", "completed"] as const;

export type PosSaleRow = {
  id: string;
  status?: string | null;
  source?: string | null;
  amount?: number | null;
  payment_method?: string | null;
  amount_due?: number | null;
  payments?: unknown;
  leads?: { id: string; name?: string | null; email?: string | null } | null;
};

export function attachUnpaidSalesToOrders<T extends { sale_id?: string | null }>(
  orders: T[],
  sales: PosSaleRow[],
): Array<
  T & {
    sales: Omit<PosSaleRow, "id"> | null;
    leads: PosSaleRow["leads"];
  }
> {
  const salesById = new Map(sales.map((sale) => [sale.id, sale]));
  return orders.map((order) => {
    const sale = order.sale_id ? salesById.get(order.sale_id) : undefined;
    if (!sale) {
      return { ...order, sales: null, leads: null };
    }
    return {
      ...order,
      sales: {
        status: sale.status,
        source: sale.source,
        amount: sale.amount,
        payment_method: sale.payment_method,
        amount_due: sale.amount_due,
        payments: sale.payments,
        leads: sale.leads,
      },
      leads: sale.leads || null,
    };
  });
}

export function isUnpaidSaleRow(sale: Pick<PosSaleRow, "amount_due">): boolean {
  return Number(sale.amount_due) > 0;
}

/** Keep only orders whose linked sale still has a balance due. */
export function selectOrdersLinkedToUnpaidSales<T extends { sale_id?: string | null }>(
  orders: T[],
  sales: PosSaleRow[],
): ReturnType<typeof attachUnpaidSalesToOrders<T>> {
  const unpaidIds = new Set(
    sales.filter(isUnpaidSaleRow).map((sale) => sale.id),
  );
  const linked = orders.filter(
    (order) => !!order.sale_id && unpaidIds.has(order.sale_id),
  );
  return selectPosOpenOrders(attachUnpaidSalesToOrders(linked, sales));
}

export { OPEN_ORDER_STATUSES };
