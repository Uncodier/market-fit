type PosSaleLike = {
  amount_due?: number | string | null;
  status?: string | null;
  payments?: Array<{ amount?: number | null }> | null;
  amount?: number | string | null;
};

type PosOpenOrderLike = {
  id?: string;
  status?: string | null;
  payment_status?: string | null;
  amount_due?: number | string | null;
  sales?: PosSaleLike | PosSaleLike[] | null;
  created_at?: string | null;
};

function firstSale(order: PosOpenOrderLike): PosSaleLike | null {
  const sales = order.sales;
  if (!sales) return null;
  return Array.isArray(sales) ? sales[0] || null : sales;
}

export function posOrderAmountDue(order: PosOpenOrderLike): number | null {
  const sale = firstSale(order);
  const raw = sale?.amount_due ?? order.amount_due;
  if (raw != null && raw !== "") {
    const due = Number(raw);
    if (Number.isFinite(due)) return due;
  }
  const amount = Number(sale?.amount);
  const payments = sale?.payments;
  if (Number.isFinite(amount) && Array.isArray(payments) && payments.length > 0) {
    const paid = payments.reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
    return amount - paid;
  }
  return null;
}

function paymentsCoverSale(sale: PosSaleLike | null): boolean {
  if (!sale) return false;
  const amount = Number(sale.amount);
  const payments = sale.payments;
  if (!Number.isFinite(amount) || !Array.isArray(payments) || payments.length === 0) {
    return false;
  }
  const paid = payments.reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
  return paid + 0.009 >= amount;
}

/** Fully paid orders should not appear in the POS order picker. */
export function isPosOrderPaid(order: PosOpenOrderLike | null | undefined): boolean {
  if (!order) return false;
  const sale = firstSale(order);
  if (paymentsCoverSale(sale)) return true;

  const due = posOrderAmountDue(order);
  if (due != null && due <= 0.009) return true;
  if (order.payment_status === "paid") return true;
  if (order.payment_status === "unpaid") return false;

  const saleCompleted = sale?.status === "completed" || sale?.status === "paid";
  // Paid from sales/POS while the ticket is still pending in the kitchen.
  if (saleCompleted && order.status !== "completed") return true;
  if (saleCompleted && due == null) return true;
  return false;
}

export function isPosOpenOrder(order: PosOpenOrderLike | null | undefined): boolean {
  if (!order) return false;
  const status = order.status;
  if (status !== "pending" && status !== "in_progress" && status !== "completed") {
    return false;
  }
  return !isPosOrderPaid(order);
}

export function posOpenOrderGroupKey(
  status?: string | null,
): "pending" | "in_progress" | "completed" {
  if (status === "in_progress" || status === "completed") return status;
  return "pending";
}

export function sortPosOpenOrders<T extends PosOpenOrderLike>(orders: T[]): T[] {
  const rank = (status?: string | null) => {
    const group = posOpenOrderGroupKey(status);
    if (group === "pending") return 0;
    if (group === "in_progress") return 1;
    return 2;
  };
  return [...orders].sort((a, b) => {
    const byGroup = rank(a.status) - rank(b.status);
    if (byGroup !== 0) return byGroup;
    return (
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime()
    );
  });
}

export function selectPosOpenOrders<T extends PosOpenOrderLike & { id?: string }>(
  orders: T[],
): T[] {
  const seen = new Set<string>();
  const unique = orders.filter((order) => {
    if (!isPosOpenOrder(order)) return false;
    if (!order.id) return true;
    if (seen.has(order.id)) return false;
    seen.add(order.id);
    return true;
  });
  return sortPosOpenOrders(unique);
}
