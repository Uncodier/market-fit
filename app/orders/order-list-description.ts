export type OrderListItem = {
  name?: string | null;
  quantity?: number | string | null;
  parent_sale_order_item_id?: string | null;
  metadata?: {
    is_modifier?: boolean;
    client_line_key?: string;
    parent_client_line_key?: string;
    parent_name?: string | null;
    printed_quantity?: number | string | null;
  } | null;
};

type OrderListDescriptionSource = {
  created_at?: string | null;
  sale_order_items?: OrderListItem[] | null;
};

function namedItems(items: OrderListItem[] | null | undefined) {
  return (items || []).filter((item) => String(item.name || "").trim());
}

function primaryItems(items: OrderListItem[] | null | undefined) {
  const named = namedItems(items);
  const parents = named.filter(
    (item) =>
      !item.parent_sale_order_item_id && !item.metadata?.is_modifier,
  );
  return parents.length > 0 ? parents : named;
}

export function formatOrderProductSummary(
  items: OrderListItem[] | null | undefined,
): string {
  return primaryItems(items)
    .map((item) => {
      const name = String(item.name).trim();
      const quantity = Number(item.quantity) || 1;
      return quantity > 1 ? `${name} ×${quantity}` : name;
    })
    .join(", ");
}

export function orderProductSearchText(
  items: OrderListItem[] | null | undefined,
): string {
  return namedItems(items)
    .map((item) => String(item.name).trim())
    .join(" ");
}

export function formatOrderTime(
  value: string | null | undefined,
  locale = "en-US",
): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatOrderListDescription(
  order: OrderListDescriptionSource,
  locale = "en-US",
): string {
  return [
    formatOrderProductSummary(order.sale_order_items),
    formatOrderTime(order.created_at, locale),
  ]
    .filter(Boolean)
    .join(" · ");
}
