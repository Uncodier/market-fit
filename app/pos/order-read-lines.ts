import { z } from "zod";

// Match stored order reconstruction without coercing null, blanks or booleans
// into payable numeric values. This is a read contract, not checkout approval.
const storedNumber = z.union([
  z.number().finite(),
  z.string().refine((value) => value.trim().length > 0 && Number.isFinite(Number(value)))
    .transform(Number),
]);
const id = z.string().min(1).max(256);
const historicalLine = z.object({
  id, catalog_item_id: id.nullable().optional(),
  unit_price: storedNumber.nullable().optional(), quantity: storedNumber.nullable().optional(),
  name: z.string().nullable().optional(), status: z.string().nullable().optional(),
  parent_sale_order_item_id: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).passthrough();
const activeLine = historicalLine.extend({
  catalog_item_id: id.nullable(), unit_price: storedNumber, quantity: storedNumber,
  name: z.string(),
});

export const posOrderReadLines = z.array(historicalLine).transform((rows, context) => {
  // The cart excludes cancelled rows and all children of cancelled parents.
  // Keep that history intact without imposing active-line pricing requirements.
  const cancelledParents = new Set(rows.filter((row) =>
    row.status === "cancelled" && !row.parent_sale_order_item_id,
  ).map((row) => row.id));
  return rows.map((row, index) => {
    if (row.status === "cancelled" ||
      (row.parent_sale_order_item_id && cancelledParents.has(row.parent_sale_order_item_id))) return row;
    const result = activeLine.safeParse(row);
    if (result.success) return result.data;
    for (const issue of result.error.issues) context.addIssue({ ...issue, path: [index, ...issue.path] });
    return z.NEVER;
  });
});