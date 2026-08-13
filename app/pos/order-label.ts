export function compactOrderNotes(notes: string | null | undefined): string {
  const oneLine = String(notes || "").replace(/\s+/g, " ").trim();
  if (!oneLine) return "";
  if (oneLine.length <= 48) return oneLine;
  return `${oneLine.slice(0, 45)}…`;
}

type OrderLabelSource = {
  created_at?: string;
  notes?: string | null;
  leads?: { name?: string | null } | null;
};

export function formatPosOrderLabel(
  order: OrderLabelSource | undefined,
  t: (key: string) => string,
  liveNotes?: string | null,
): string {
  const notes = compactOrderNotes(
    liveNotes !== undefined ? liveNotes : order?.notes,
  );
  if (notes) return notes;

  const orderWord = t("pos.order") === "pos.order" ? "Order" : t("pos.order");
  if (!order?.created_at) return orderWord;

  const timeString = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
  }).format(new Date(order.created_at));
  const customerName = order.leads?.name ? ` (${order.leads.name})` : "";
  return `${orderWord} - ${timeString}${customerName}`;
}
