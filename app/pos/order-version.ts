function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, canonical(entry)]),
  );
  return value ?? null;
}

/** Compare server snapshots, never the cashier's edited cart or a display total. */
export function posOrderVersion(value: unknown): string {
  const order = record(value);
  const sale = record(Array.isArray(order.sales) ? order.sales[0] : order.sales);
  const lead = record(order.leads || sale.leads);
  const fields = ["id", "site_id", "sale_id", "status", "currency", "subtotal",
    "tax_total", "discount_total", "total", "price_list_id", "promotion_id",
    "fulfillment_method", "origin_location_id", "buyer_user_id", "seller_user_id",
    "scheduled_for", "shipping_address", "notes"];
  const items = (Array.isArray(order.sale_order_items) ? order.sale_order_items : [])
    .map(record).map((line) => ({
      id: line.id, catalog_item_id: line.catalog_item_id, quantity: Number(line.quantity),
      unit_price: Number(line.unit_price), status: line.status,
      parent_sale_order_item_id: line.parent_sale_order_item_id,
      client_line_key: record(line.metadata).client_line_key,
      modifier_group_id: record(line.metadata).modifier_group_id,
    })).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return JSON.stringify(canonical({
    ...Object.fromEntries(fields.map((key) => [key, order[key]])),
    lead_id: lead.id,
    sale: { status: sale.status, amount: sale.amount, amount_due: sale.amount_due,
      payments: sale.payments },
    items,
  }));
}